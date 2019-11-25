import { V3WebsocketClient } from '@okfe/okex-node';
import * as config from './config';
const wss = new V3WebsocketClient(config.websocekHost);

// websocket 初始化
wss.connect();
wss.on('open', () => {
    console.log('websocket open!!!');
    wss.login(config.httpkey, config.httpsecret, config.passphrase);
});

function afterLogin() {
    // 订阅BTC永续合约
    wss.subscribe('swap/ticker:BTC-USD-SWAP');
    // wss.subscribe('swap/candle300s:BTC-USD-SWAP');
}

// websocket 返回消息
wss.on('message', wsMessage);
function wsMessage(data){
    const obj = JSON.parse(data);
    const eventType = obj.event;
    if (eventType === 'login') {
        // 登录消息
        if (obj.success === true) {
            console.log('登录成功');
            afterLogin();
        }
    }else if (eventType === undefined) {
        // 行情消息相关
        tableMsg(obj);
    }
}

function tableMsg(marketData){
    const tableType = marketData.table;
    if (tableType === 'swap/ticker') {
        // 行情数据
        const best_ask = marketData.data[0].best_ask; // 卖一价
        const best_bid = marketData.data[0].best_bid; // 买一价
        const last = marketData.data[0].last; // 最新成交价
        console.log('卖' + best_ask, '买' + best_bid, '成交价' + last);
    }
    if (tableType.indexOf('swap/candle') === 0) {
        console.log(marketData.data);
    }
}