const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const app = express();

const APPID = process.env.WECHAT_APPID;
const APPSECRET = process.env.WECHAT_APPSECRET;

console.log('WECHAT_APPID:', APPID);
console.log('WECHAT_APPSECRET:', APPSECRET);

let accessTokenCache = { token: null, expiresAt: 0 };
let jsapiTicketCache = { ticket: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Date.now();

  if (accessTokenCache.token && accessTokenCache.expiresAt > now) {
    return accessTokenCache.token;
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.access_token) {
    accessTokenCache.token = data.access_token;
    accessTokenCache.expiresAt = now + (data.expires_in - 300) * 1000;
    return data.access_token;
  } else {
    throw new Error('Failed to get access_token: ' + JSON.stringify(data));
  }
}

async function getJsapiTicket() {
  const now = Date.now();

  if (jsapiTicketCache.ticket && jsapiTicketCache.expiresAt > now) {
    return jsapiTicketCache.ticket;
  }

  const accessToken = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=${accessToken}&type=jsapi`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.ticket) {
    jsapiTicketCache.ticket = data.ticket;
    jsapiTicketCache.expiresAt = now + (data.expires_in - 300) * 1000;
    return data.ticket;
  } else {
    throw new Error('Failed to get jsapi_ticket: ' + JSON.stringify(data));
  }
}

function createNonceStr(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let str = '';
  for (let i = 0; i < length; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

function generateSignature(jsapi_ticket, nonceStr, timestamp, url) {
  const rawString = `jsapi_ticket=${jsapi_ticket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  const hash = crypto.createHash('sha1');
  hash.update(rawString);
  return hash.digest('hex');
}

app.get('/sign', async (req, res) => {
  try {
    const url = decodeURIComponent(req.query.url);
    const jsapi_ticket = await getJsapiTicket();
    const nonceStr = createNonceStr();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature(jsapi_ticket, nonceStr, timestamp, url);

    res.json({
      appId: APPID,
      timestamp,
      nonceStr,
      signature,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 80;
app.listen(port, () => {
  console.log(`WeChat Sign Server running on port ${port}`);
});
