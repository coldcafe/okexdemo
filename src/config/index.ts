import defaultConf from './default';
import privateConf from './private';

defaultConf.httpkey = privateConf.httpkey;
defaultConf.httpsecret = privateConf.httpsecret;
defaultConf.passphrase = privateConf.passphrase;

export default defaultConf;