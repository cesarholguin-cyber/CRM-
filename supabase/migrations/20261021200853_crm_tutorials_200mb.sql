-- Increase the tutorial limit to 200 MiB; video bytes remain in Backblaze.
ALTER TABLE crm.tutorials
    DROP CONSTRAINT tutorials_size_bytes_check,
    ADD CONSTRAINT tutorials_size_bytes_check
        CHECK (size_bytes > 0 AND size_bytes <= 209715200);
