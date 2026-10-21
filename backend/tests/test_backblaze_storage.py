"""Backblaze routing, private access, version cleanup and sanitized errors."""
import os
os.environ['DATABASE_MODE'] = 'external'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite:///:memory:'
os.environ['DATABASE_URL_SYNC'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'integration-tests-only-not-production'
import io
from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock
import pytest
from fastapi import HTTPException
from botocore.exceptions import ClientError
from app.services import backblaze_storage as b2, tutorial_storage as storage
from app.core.config import settings


@pytest.fixture
def fake(monkeypatch):
    s3=MagicMock()
    s3.get_bucket_acl.return_value={'Grants':[{'Grantee':{'Type':'CanonicalUser'},'Permission':'FULL_CONTROL'}]}
    monkeypatch.setattr(b2,'client',lambda:s3)
    monkeypatch.setattr(settings,'B2_BUCKET','test-private-bucket')
    return s3


async def test_upload_streams_file_to_b2_private_bucket(fake):
    body=io.BytesIO(b'test video')
    await b2.upload('b2/tutorials/1/id.mp4',SimpleNamespace(file=body),'video/mp4',10)
    fake.get_bucket_acl.assert_called_once_with(Bucket='test-private-bucket')
    fake.put_object.assert_called_once_with(Bucket='test-private-bucket',Key='b2/tutorials/1/id.mp4',
        Body=body,ContentLength=10,ContentType='video/mp4',ContentDisposition='inline',CacheControl='private, max-age=3600')
    fake.close.assert_called_once()


async def test_public_bucket_rejected_before_upload(fake):
    fake.get_bucket_acl.return_value={'Grants':[{'Grantee':{'Type':'Group','URI':'http://acs.amazonaws.com/groups/global/AllUsers'}}]}
    with pytest.raises(HTTPException) as error:
        await b2.upload('b2/tutorials/1/id.mp4',SimpleNamespace(file=io.BytesIO(b'x')),'video/mp4',1)
    assert error.value.status_code==503
    fake.put_object.assert_not_called()


async def test_failed_upload_removes_all_versions_only_for_its_exact_key(fake):
    path='b2/tutorials/1/id.mp4'
    fake.get_paginator.return_value.paginate.return_value=[{
        'Versions':[{'Key':path,'VersionId':'v1'},{'Key':path+'.other','VersionId':'keep'}],
        'DeleteMarkers':[{'Key':path,'VersionId':'marker'}]}, {'Versions':[{'Key':path,'VersionId':'v2'}]}]
    await b2.remove(path)
    assert [call.kwargs['VersionId'] for call in fake.delete_object.call_args_list]==['v1','marker','v2']
    fake.get_paginator.assert_called_once_with('list_object_versions')


async def test_playback_is_temporary_signed_get(fake):
    fake.generate_presigned_url.return_value='https://private.example/video?signature=temporary'
    assert await b2.signed_url('b2/tutorials/1/id.mp4',3600)==fake.generate_presigned_url.return_value
    fake.generate_presigned_url.assert_called_once_with('get_object',Params={
        'Bucket':'test-private-bucket','Key':'b2/tutorials/1/id.mp4','ResponseContentDisposition':'inline'},
        ExpiresIn=3600,HttpMethod='GET')


async def test_provider_errors_do_not_expose_credentials(fake,caplog):
    fake.get_bucket_acl.side_effect=ClientError({'Error':{'Code':'AccessDenied','Message':'secret-token-do-not-leak'}},'GetBucketAcl')
    with pytest.raises(HTTPException) as error:await b2.verify_bucket()
    assert error.value.status_code==503
    assert 'secret-token' not in str(error.value) and 'secret-token' not in caplog.text
    fake.close.assert_called_once()


async def test_new_uploads_never_fall_back_to_supabase(monkeypatch):
    upload=AsyncMock(side_effect=HTTPException(503,'Backblaze unavailable'))
    legacy=AsyncMock()
    monkeypatch.setattr(b2,'upload',upload)
    monkeypatch.setattr(storage,'storage_request',legacy)
    path=storage.new_video_path(9,'.mp4')
    assert path.startswith('b2/tutorials/9/')
    with pytest.raises(HTTPException):await storage.upload_video(path,None,'video/mp4',100)
    legacy.assert_not_called()
    with pytest.raises(HTTPException):await storage.upload_video('9/legacy.mp4',None,'video/mp4',100)
    assert upload.await_count==1


async def test_legacy_playback_preserved_and_b2_playback_routed(monkeypatch):
    remote=AsyncMock(return_value={'signedURL':'/object/sign/legacy?token=short-lived'})
    signer=AsyncMock(return_value='https://b2.example/signed')
    monkeypatch.setattr(storage,'storage_request',remote)
    monkeypatch.setattr(b2,'signed_url',signer)
    monkeypatch.setattr(settings,'SUPABASE_URL','https://legacy.example')
    assert await storage.signed_video_url('b2/tutorials/9/new.mp4')=='https://b2.example/signed'
    remote.assert_not_called()
    assert await storage.signed_video_url('9/old.mp4')=='https://legacy.example/storage/v1/object/sign/legacy?token=short-lived'
    assert remote.call_args.args==('POST','/object/sign/crm-tutoriales/9/old.mp4')


def test_client_uses_server_credentials_sigv4_and_path_addressing(monkeypatch):
    for k,v in {'B2_ENDPOINT_URL':'https://s3.us-east-005.backblazeb2.com','B2_REGION':'us-east-005',
        'B2_BUCKET':'CRM-Terrenos','B2_APPLICATION_KEY_ID':'fake-id','B2_APPLICATION_KEY':'fake-secret'}.items():
        monkeypatch.setattr(settings,k,v)
    create=MagicMock();monkeypatch.setattr(b2.boto3,'client',create)
    b2.client()
    options=create.call_args.kwargs
    assert options['aws_access_key_id']=='fake-id' and options['aws_secret_access_key']=='fake-secret'
    assert options['config'].signature_version=='s3v4'
    assert options['config'].s3['addressing_style']=='path'
    monkeypatch.setattr(settings,'B2_APPLICATION_KEY','')
    with pytest.raises(HTTPException) as error:b2.client()
    assert error.value.status_code==503
