import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import MisFacturas from './MisFacturas'

/**
 * Cobranzas que además escanea lo de su propia sucursal (por ejemplo, Rocamora): la misma pantalla
 * que usa cualquier sucursal, con sus facturas, la carga de varios archivos y los PDF en espera.
 * Al salir, el selector de sucursal vuelve a como estaba.
 */
export default function MiSucursal() {
  const { rol, sucursal, setSucursal, sucursalPropia } = useApp()
  const anterior = useRef(sucursal)
  useEffect(() => {
    if (!sucursalPropia) return
    const previa = anterior.current
    setSucursal(sucursalPropia)
    return () => setSucursal(previa)
  }, [sucursalPropia, setSucursal])
  if (rol !== 'auditoria' || !sucursalPropia) return <Navigate to="/app" replace />
  if (sucursal !== sucursalPropia) return null
  return <MisFacturas />
}
