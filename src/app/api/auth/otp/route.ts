import {NextRequest,NextResponse} from 'next/server';import {randomInt,createHmac,randomBytes,timingSafeEqual} from 'crypto';import {cookies} from 'next/headers';import {rateLimit} from '@/lib/rate-limit';import {getSupabaseServerClient} from '@/lib/supabase/server';
const secret=process.env.AUTH_CHALLENGE_SECRET||randomBytes(32).toString('hex');
export async function GET(){const a=randomInt(1,10),b=randomInt(1,10),expiry=Date.now()+300000;const value=(a+b)+'.'+expiry;const jar=await cookies();jar.set('bb_auth_check',value+'.'+createHmac('sha256',secret).update(value).digest('hex'),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:300,path:'/api/auth/otp'});return NextResponse.json({question:a+' + '+b+' = ?'});}
export async function POST(req:NextRequest){try{const b=await req.json();const phone=String(b.phone||'').replace(/\D/g,'').slice(-10);const email=String(b.email||'').trim();const identity=email||phone;const verify=b.action==='verify';
 if(email?!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email):!/^[6-9]\d{9}$/.test(phone))return NextResponse.json({ok:false,message:'Enter a valid mobile or email'},{status:400});
 if(!await rateLimit((verify?'verify:':'send:')+identity,verify?10:5,600))return NextResponse.json({ok:false,message:'Too many attempts. Try later.'},{status:429});
 const sb=await getSupabaseServerClient();
 if(!verify){if(!b.consent)return NextResponse.json({ok:false,message:'Accept Terms and Privacy to continue.'},{status:400});const jar=await cookies();const c=jar.get('bb_auth_check')?.value.split('.');if(!c||c.length!==3||Number(c[1])<Date.now()||c[0]!==String(b.answer))return NextResponse.json({ok:false,message:'Complete the security check.'},{status:400});const expected=createHmac('sha256',secret).update(c[0]+'.'+c[1]).digest('hex');if(expected.length!==c[2].length||!timingSafeEqual(Buffer.from(expected),Buffer.from(c[2])))return NextResponse.json({ok:false,message:'Security check expired.'},{status:400});
 if(sb){const {error}=await sb.auth.signInWithOtp(email?{email}:{phone:'+91'+phone,options:{channel:b.channel==='whatsapp'?'whatsapp':'sms'}});if(error)return NextResponse.json({ok:false,message:'OTP could not be sent. Check provider configuration.'},{status:400});}else if(process.env.AUTH_MODE!=='mock'||process.env.NODE_ENV==='production')return NextResponse.json({ok:false,message:'Login provider not configured'},{status:503});
 return NextResponse.json({ok:true,message:sb?'OTP sent.': 'Mock mode: use 123456'});
 }
 if(!/^\d{6,8}$/.test(String(b.otp)))return NextResponse.json({ok:false,message:'Invalid code'},{status:400});
 if(!sb)return NextResponse.json({ok:process.env.AUTH_MODE==='mock'&&process.env.NODE_ENV!=='production'&&b.otp==='123456',mock:true,message:'Mock verification'});
 const {data,error}=await sb.auth.verifyOtp(email?{email,token:b.otp,type:'email'}:{phone:'+91'+phone,token:b.otp,type:'sms'});
 if(error||!data.user)return NextResponse.json({ok:false,message:'Invalid or expired OTP'},{status:400});
 if(typeof b.name==='string'&&b.name.trim())await sb.from('profiles').update({name:b.name.trim().slice(0,100)}).eq('id',data.user.id);
 return NextResponse.json({ok:true,user:data.user,message:'Signed in'});
 }catch{return NextResponse.json({ok:false,message:'Login unavailable'},{status:400});}}
