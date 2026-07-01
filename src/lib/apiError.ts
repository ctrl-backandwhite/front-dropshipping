// Mensaje de error de la API para mostrar al usuario. La LOCALIZACIÓN la hace el backend (fuente única:
// enum ErrorCode resuelto por el idioma del header X-Lang), así que `response.data.message` ya viene en
// el idioma de navegación. Aquí solo elegimos ese mensaje o un genérico localizado si no hubiera ninguno.
export function apiErrorMessage(err: any, t: (key: string) => string): string {
  return err?.response?.data?.message || t('errors.generic')
}
