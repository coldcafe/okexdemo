import axios from 'axios';

export default (mdText: string, token: string) => {
    return axios({
        method: 'post',
        url: 'https://oapi.dingtalk.com/robot/send',
        params: { access_token: token },
        data: {
            msgtype: 'markdown',
            markdown: {
                title: `macd`,
                text: mdText,
            },
        },
    }).catch(() => {
      console.error('钉钉消息发送失败！');
    });
};