import defaultConf from './default';
import privateConf from './private';

defaultConf.httpkey = privateConf.httpkey;
defaultConf.httpsecret = privateConf.httpsecret;
defaultConf.passphrase = privateConf.passphrase;
if (privateConf['urlHost']) {
  defaultConf.urlHost = privateConf['urlHost'];
}
if (privateConf['websocekHost']) {
  defaultConf.websocekHost = privateConf['websocekHost'];
}

export default defaultConf;