export const homeForRole = role => role === 'SISTEMAS' ? '/videos' : role === 'PROMOTOR' ? '/projects' : '/dashboard';
export const roleLabel = role => ({ ADMIN: 'Administrador', PROMOTOR: 'Promotor', SISTEMAS: 'Sistemas' })[role] || role;
