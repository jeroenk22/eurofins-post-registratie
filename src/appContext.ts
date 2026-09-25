/**
 * Draait deze build als Netlify deploy preview? Een preview is een eigen origin;
 * wie hem installeert heeft twee apps naast elkaar. Daarom geen installatiebanner.
 */
export const IS_DEPLOY_PREVIEW = __APP_CONTEXT__ === 'deploy-preview';
