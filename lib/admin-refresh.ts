import {createHmac,timingSafeEqual} from 'node:crypto';
export const REFRESH_COOKIE='voiceroom-refresh-admin';
export const equalSecret=(a:string,b:string)=>{const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length&&timingSafeEqual(left,right);};
export function adminSession(key:string,expires=Date.now()+8*60*60*1000){return `${expires}.${createHmac('sha256',key).update(String(expires)).digest('hex')}`;}
export function validAdminSession(value:string,key:string,now=Date.now()){
  const parts=value.split('.'),expires=Number(parts[0]);return parts.length===2&&Number.isSafeInteger(expires)&&expires>now&&expires<=now+9*60*60*1000&&equalSecret(value,adminSession(key,expires));
}
