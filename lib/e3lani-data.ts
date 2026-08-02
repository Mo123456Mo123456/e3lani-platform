export const BRAND={yellow:"#FFC400",yellowDark:"#E9AE00",black:"#111111",charcoal:"#252525",white:"#FFFFFF",surface:"#F7F7F7",border:"#E8E8E8",muted:"#6F6F6F",success:"#18864B",warning:"#C86A00",error:"#C9352B"} as const;
export type Locale="ar"|"en"; export type AccountType="viewer"|"advertiser"|"brand"; export type StaffRole="user"|"reviewer"|"support"|"finance"|"admin"|"owner";
export type AdStatus="draft"|"awaiting_payment"|"pending_review"|"changes_requested"|"active"|"paused"|"rejected"|"expired"|"removed";
export type ContactType="store"|"product"|"whatsapp"|"phone"; export type PromotionCode="highlight_3"|"highlight_7"|"top_category"|"city_targeting";
export type Category={id:string;ar:string;en:string;icon:string}; export type City={id:string;ar:string;en:string;region:string};
export type AdMedia={id:string;kind:"image"|"video";uri:string;mediaAssetId?:number;processingStatus?:"processing"|"ready"|"failed";localAsset?:"poster"|"wordmark"|"icon"}; export type AdContact={type:ContactType;value:string};
export type AiModerationLabel="SAFE"|"NEEDS_REVIEW"|"BLOCKED";
export type AdvertiserSummary={id:string;username:string;displayName:string;avatarUrl:string|null;verified:boolean};
export type Ad={id:string;ownerId:string;advertiser?:AdvertiserSummary;brandId?:string;title:string;description:string;categoryId:string;cityId:string;countryCode?:string;media:AdMedia[];contacts:AdContact[];status:AdStatus;revision:number;verified:boolean;featured:boolean;sponsored:boolean;createdAt:string;activatedAt?:string;expiresAt?:string;lastRepublishedAt?:string;promotions:PromotionCode[];aiLabel?:AiModerationLabel;paymentStatus?:"not_required"|"pending"|"paid"|"failed";priceSnapshot?:{basePrice:number;discount:number;tax:number;finalPrice:number;currency:string;freeReason:string|null}};
export type UserProfile={id:string;name:string;phone:string;email?:string;cityId:string;countryCode?:string;accountType:AccountType;role:StaffRole;bio?:string};
export type BrandProfile={id:string;ownerId:string;name:string;slug:string;bio:string;website?:string;logoAsset?:"wordmark"|"icon";verified:boolean;verificationStatus:"unverified"|"pending"|"verified"|"rejected"};
export type Metrics={impressions:number;views:number;saves:number;shares:number;contacts:number}; export type NotificationItem={id:string;title:string;body:string;read:boolean;createdAt:string;kind:"payment"|"review"|"expiry"|"system"};
export type ReportItem={id:string;adId:string;reason:string;details?:string;status:"open"|"resolved";createdAt:string}; export type Order={id:string;adId:string;items:PromotionCode[];totalHalalas:number;status:"pending"|"paid"|"failed"|"refunded";provider:"sandbox"|"external";createdAt:string};
export type Invoice={id:string;orderId:string;number:string;totalHalalas:number;issuedAt:string}; export type AuditLog={id:string;actor:string;action:string;target:string;reason:string;createdAt:string};
export const REPUBLISH_COOLDOWN_MS=72*60*60*1000;
export function canRepublish(lastRepublishedAt?:string,nowMs=Date.now()){if(!lastRepublishedAt)return true;const value=new Date(lastRepublishedAt).getTime();return Number.isFinite(value)&&nowMs-value>=REPUBLISH_COOLDOWN_MS}
export type ModerationDecision="approved"|"changes_requested"|"rejected";
export type LaunchMode="PROFILE_ONLY"|"FREE_LAUNCH"|"PAID_ONLY";
export type ProfilePost={id:string;ownerId:string;title:string;text:string;media?:AdMedia;createdAt:string};
/** Default operating mode for the current product phase. */
export const DEFAULT_LAUNCH_MODE:LaunchMode="FREE_LAUNCH";
export const FUTURE_PROMO_PRICE_HALALAS=5900;
export function addDaysIso(iso:string,days:number){const value=new Date(iso).getTime();if(!Number.isFinite(value))throw new Error("INVALID_ISO_DATE");return new Date(value+days*24*60*60*1000).toISOString()}
export function transitionToPendingReview(ad:Ad,items:PromotionCode[]){if(ad.status!=="awaiting_payment")return ad;return{...ad,status:"pending_review" as const,promotions:[...new Set(items)]}}
export function moderatePendingAd(ad:Ad,decision:ModerationDecision,nowIso:string){if(ad.status!=="pending_review")return ad;const status:AdStatus=decision==="approved"?"active":decision;return{...ad,status,activatedAt:decision==="approved"?nowIso:ad.activatedAt,expiresAt:decision==="approved"?addDaysIso(nowIso,30):ad.expiresAt}}
export function extendAdPeriod(ad:Ad){if((ad.status!=="active"&&ad.status!=="paused")||!ad.expiresAt)return ad;return{...ad,expiresAt:addDaysIso(ad.expiresAt,15)}}
export function republishExpiredAd(ad:Ad,nowIso:string){const nowMs=new Date(nowIso).getTime();if(ad.status!=="expired"||!Number.isFinite(nowMs)||!canRepublish(ad.lastRepublishedAt,nowMs))return ad;return{...ad,status:"active" as const,lastRepublishedAt:nowIso,activatedAt:nowIso,expiresAt:addDaysIso(nowIso,30)}}
/** Resolve initial ad status from launch mode. FREE_LAUNCH activates immediately with no payment. */
export function resolveCreateStatus(mode:LaunchMode,nowIso:string):Pick<Ad,"status"|"activatedAt"|"expiresAt">{
  if(mode==="FREE_LAUNCH"){
    return{status:"active",activatedAt:nowIso,expiresAt:addDaysIso(nowIso,30)};
  }
  if(mode==="PROFILE_ONLY"){
    return{status:"draft"};
  }
  return{status:"awaiting_payment"};
}
export function isPaymentFlowVisible(mode:LaunchMode,paymentEnabled=false){
  return mode==="PAID_ONLY"&&paymentEnabled;
}
export const seedBrand:BrandProfile={id:"brand-e3lani",ownerId:"seed-owner",name:"إعلاني E3lani",slug:"e3lani",bio:"منصة الإعلانات المرئية لكل شيء في السعودية.",website:"https://example.com",logoAsset:"wordmark",verified:true,verificationStatus:"verified"};
export const seedAds:Ad[]=[
 {id:"AD10001",ownerId:"seed-owner",brandId:seedBrand.id,title:"اعرض إعلانك ووصل عملاءك مباشرة",description:"منصة سعودية للإعلانات المرئية تتيح لك نشر إعلان بصورة أو فيديو والوصول إلى الجمهور المناسب بسهولة.",categoryId:"services",cityId:"riyadh",countryCode:"SA",media:[{id:"m1",kind:"image",uri:"asset:poster",localAsset:"poster"}],contacts:[{type:"store",value:"https://example.com"},{type:"whatsapp",value:"+966500000000"}],status:"active",revision:1,verified:true,featured:true,sponsored:true,createdAt:"2026-07-01T08:00:00.000Z",activatedAt:"2026-07-01T09:00:00.000Z",expiresAt:"2026-07-31T09:00:00.000Z",promotions:["highlight_7"],aiLabel:"SAFE",paymentStatus:"not_required"},
 {id:"AD10002",ownerId:"seed-owner",brandId:seedBrand.id,title:"مساحتك الإعلانية تبدأ من هنا",description:"واجهة نظيفة، تواصل مباشر، وإحصاءات واضحة تساعد المعلن على معرفة أداء إعلانه.",categoryId:"services",cityId:"jeddah",countryCode:"SA",media:[{id:"m2",kind:"image",uri:"asset:wordmark",localAsset:"wordmark"}],contacts:[{type:"phone",value:"+966500000000"}],status:"active",revision:1,verified:true,featured:false,sponsored:false,createdAt:"2026-07-02T08:00:00.000Z",activatedAt:"2026-07-02T09:00:00.000Z",expiresAt:"2026-08-01T09:00:00.000Z",promotions:[],aiLabel:"SAFE",paymentStatus:"not_required"},
 {id:"AD10003",ownerId:"seed-ae",title:"فيلا عصرية في دبي",description:"مساحات رحبة وتصميم حديث بالقرب من أهم الخدمات في الإمارات.",categoryId:"real-estate",cityId:"dubai",countryCode:"AE",media:[{id:"m3",kind:"image",uri:"asset:poster",localAsset:"poster"}],contacts:[{type:"phone",value:"+971500000000"}],status:"active",revision:1,verified:true,featured:false,sponsored:true,createdAt:"2026-07-28T10:00:00.000Z",activatedAt:"2026-07-28T10:00:00.000Z",expiresAt:"2026-08-27T10:00:00.000Z",promotions:[],aiLabel:"SAFE",paymentStatus:"not_required"},
 {id:"AD10004",ownerId:"seed-eg",title:"فيلا عائلية قريبة من الخدمات",description:"فيلا واسعة بتصميم حديث، حديقة خارجية، مواقف خاصة، وموقع هادئ قرب المدارس.",categoryId:"real-estate",cityId:"cairo",countryCode:"EG",media:[{id:"m4",kind:"image",uri:"asset:poster",localAsset:"poster"}],contacts:[{type:"whatsapp",value:"+201000000000"}],status:"active",revision:1,verified:false,featured:false,sponsored:false,createdAt:"2026-07-29T10:00:00.000Z",activatedAt:"2026-07-29T10:00:00.000Z",expiresAt:"2026-08-28T10:00:00.000Z",promotions:[],aiLabel:"SAFE",paymentStatus:"not_required"}];
