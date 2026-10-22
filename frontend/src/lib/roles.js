export const homeForRole = role => role === 'PROMOTOR' ? '/projects' : '/dashboard';
export const roleLabel = role => ({ ADMIN: 'Administrador', PROMOTOR: 'Promotor' })[role] || role;
