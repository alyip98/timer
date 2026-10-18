// Apple Silicon refuses to launch unsigned/broken-signature apps ("app is damaged").
// Without a paid Developer ID we ad-hoc sign the bundle so it at least launches after right-click > Open.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
