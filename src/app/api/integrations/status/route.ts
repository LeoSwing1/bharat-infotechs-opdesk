import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(){
  const session=await getSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!(session.role==="SUPER_ADMIN" || await hasPermission(session,"admin.manage_settings")))return NextResponse.json({error:"Forbidden"},{status:403});
  const google=Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const smtp=Boolean(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
  const whatsapp=process.env.TWILIO_ENABLED==="true" && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  const webPush=Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const automation=Boolean(process.env.AUTOMATION_SECRET);
  return NextResponse.json({integrations:{database:{configured:true,provider:"PostgreSQL"},email:{configured:smtp,provider:"SMTP / Nodemailer"},googleCalendar:{configured:google,provider:"Google Calendar OAuth"},whatsapp:{configured:whatsapp,provider:"Twilio WhatsApp"},browserPush:{configured:webPush,provider:"Web Push / VAPID"},mobilePush:{configured:webPush,provider:"FCM/APNs bridge ready"},automation:{configured:automation,provider:"OPDesk Automation API"},chat:{configured:true,provider:"OPDesk realtime polling + PostgreSQL"}}});
}
