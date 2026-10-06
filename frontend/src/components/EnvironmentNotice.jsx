import { useEffect, useState } from 'react';
export default function EnvironmentNotice() {
  const [test, setTest] = useState(false);
  useEffect(()=>{let active=true;fetch('/health').then(r=>r.json()).then(data=>{if(active)setTest(data.database_mode==='embedded');}).catch(()=>{});return()=>{active=false;};},[]);
  return test ? <div role="status" className="crm-environment">Entorno de pruebas · Base de datos temporal integrada · Usa únicamente datos de prueba</div> : null;
}
