export const BRAND={yellow:"#FFC400",yellowDark:"#E9AE00",black:"#111111",charcoal:"#252525",white:"#FFFFFF",surface:"#F7F7F7",border:"#E8E8E8",muted:"#6F6F6F",success:"#18864B",warning:"#C86A00",error:"#C9352B"} as const;
export type Locale="ar"|"en"; export type AccountType="viewer"|"advertiser"|"brand"; export type StaffRole="user"|"reviewer"|"support"|"finance"|"admin"|"owner";
export type AdStatus="draft"|"awaiting_payment"|"pending_review"|"changes_requested"|"active"|"paused"|"rejected"|"expired"|"removed";
export type ContactType="store"|"product"|"whatsapp"|"phone"|"external"; export type PromotionCode="highlight_3"|"highlight_7"|"top_category"|"city_targeting";
export type LaunchMode="PROFILE_ONLY"|"FREE_LAUNCH"|"PAID_ONLY";
export type Category={id:string;ar:string;en:string;icon:string}; export type City={id:string;ar:string;en:string;region:string};
export type Market={code:string;ar:string;en:string;regionIds:string[]};
export type AdMedia={id:string;kind:"image"|"video";uri:string;mediaAssetId?:number;processingStatus?:"processing"|"ready"|"failed";localAsset?:"poster"|"wordmark"|"icon"}; export type AdContact={type:ContactType;value:string};
export type Ad={id:string;ownerId:string;brandId?:string;title:string;description:string;categoryId:string;cityId:string;media:AdMedia[];contacts:AdContact[];status:AdStatus;revision:number;verified:boolean;featured:boolean;sponsored:boolean;createdAt:string;activatedAt?:string;expiresAt?:string;lastRepublishedAt?:string;promotions:PromotionCode[];ownerName?:string;ownerAvatar?:string};
export type ProfilePost={id:string;ownerId:string;title:string;text:string;media?:string;createdAt:string};
export type UserProfile={id:string;name:string;phone:string;email?:string;cityId:string;accountType:AccountType;role:StaffRole;bio?:string;avatar?:string};
export type BrandProfile={id:string;ownerId:string;name:string;slug:string;bio:string;website?:string;logoAsset?:"wordmark"|"icon";verified:boolean;verificationStatus:"unverified"|"pending"|"verified"|"rejected"};
export type Metrics={impressions:number;views:number;saves:number;shares:number;contacts:number}; export type NotificationItem={id:string;title:string;body:string;read:boolean;createdAt:string;kind:"payment"|"review"|"expiry"|"system"};
export type ReportItem={id:string;adId:string;reason:string;details?:string;status:"open"|"resolved";createdAt:string}; export type Order={id:string;adId:string;items:PromotionCode[];totalHalalas:number;status:"pending"|"paid"|"failed"|"refunded";provider:"sandbox"|"external";createdAt:string};
export type Invoice={id:string;orderId:string;number:string;totalHalalas:number;issuedAt:string}; export type AuditLog={id:string;actor:string;action:string;target:string;reason:string;createdAt:string};
/** Default operating mode for the client core until admin config is wired. */
export const DEFAULT_LAUNCH_MODE:LaunchMode="FREE_LAUNCH";
export const FUTURE_PROMO_PRICE_HALALAS=5900;
export const FUTURE_PROMO_DAYS=30;
export const markets:Market[]=[
  {code:"SA",ar:"السعودية",en:"Saudi Arabia",regionIds:["sa","saudi","riyadh","makkah","eastern","asir","jazan","tabuk","madinah"]},
  {code:"AE",ar:"الإمارات",en:"United Arab Emirates",regionIds:["ae","uae","dubai","abu-dhabi","sharjah"]},
  {code:"EG",ar:"مصر",en:"Egypt",regionIds:["eg","egypt","cairo","giza","alexandria"]},
];
/** Offline fallback categories aligned with the AppsGeyser HTML core. */
export const fallbackCategories:Category[]=[
  {id:"cars",ar:"السيارات",en:"Cars",icon:"directions-car"},
  {id:"realestate",ar:"العقارات",en:"Real estate",icon:"home"},
  {id:"electronics",ar:"الإلكترونيات",en:"Electronics",icon:"smartphone"},
  {id:"furniture",ar:"الأثاث",en:"Furniture",icon:"weekend"},
  {id:"fashion",ar:"الأزياء",en:"Fashion",icon:"checkroom"},
  {id:"services",ar:"الخدمات",en:"Services",icon:"handyman"},
  {id:"jobs",ar:"الوظائف",en:"Jobs",icon:"work"},
  {id:"equipment",ar:"المعدات",en:"Equipment",icon:"construction"},
  {id:"pets",ar:"الحيوانات المسموح بها",en:"Allowed pets",icon:"pets"},
  {id:"games",ar:"الألعاب",en:"Games",icon:"sports-esports"},
  {id:"rentals",ar:"التأجير",en:"Rentals",icon:"vpn-key"},
  {id:"home",ar:"المنتجات المنزلية",en:"Home products",icon:"cottage"},
  {id:"homemade",ar:"الأسر المنتجة",en:"Home businesses",icon:"restaurant"},
  {id:"tickets",ar:"التذاكر",en:"Tickets",icon:"confirmation-number"},
  {id:"beauty",ar:"الصحة والجمال",en:"Health & beauty",icon:"favorite"},
  {id:"education",ar:"التعليم",en:"Education",icon:"school"},
  {id:"travel",ar:"السفر",en:"Travel",icon:"flight"},
  {id:"restaurants",ar:"المطاعم",en:"Restaurants",icon:"restaurant-menu"},
  {id:"brands",ar:"البراندات",en:"Brands",icon:"storefront"},
  {id:"exchange",ar:"التبادل والتبرع",en:"Exchange & donate",icon:"recycling"},
  {id:"other",ar:"أخرى",en:"Other",icon:"more-horiz"},
];
export function cityIdsForMarket(cities:City[],marketCode:string):string[]{
  const market=markets.find((item)=>item.code===marketCode)??markets[0];
  const regions=new Set(market.regionIds.map((id)=>id.toLowerCase()));
  return cities
    .filter((city)=>{
      const region=city.region.toLowerCase();
      const id=city.id.toLowerCase();
      return regions.has(region)||[...regions].some((token)=>id.includes(token)||region.includes(token));
    })
    .map((city)=>city.id);
}
/** Publish helper for FREE_LAUNCH: active immediately, no payment path. */
export function buildFreeLaunchAd(
  input:Omit<Ad,"status"|"revision"|"featured"|"sponsored"|"promotions"|"activatedAt"|"expiresAt"|"verified"> & {verified?:boolean},
  nowIso=new Date().toISOString(),
):Ad{
  return{
    ...input,
    verified:Boolean(input.verified),
    featured:false,
    sponsored:false,
    promotions:[],
    status:"active",
    revision:1,
    activatedAt:nowIso,
    expiresAt:addDaysIso(nowIso,FUTURE_PROMO_DAYS),
    createdAt:input.createdAt||nowIso,
  };
}
export function contactCtaLabel(type:ContactType,locale:Locale="ar"):string{
  const ar:Record<ContactType,string>={whatsapp:"تواصل عبر واتساب",phone:"اتصال بالمعلن",store:"زيارة المتجر",product:"صفحة المنتج",external:"فتح الرابط"};
  const en:Record<ContactType,string>={whatsapp:"WhatsApp",phone:"Call advertiser",store:"Visit store",product:"Product page",external:"Open link"};
  return (locale==="ar"?ar:en)[type];
}
export function buildContactUrl(contact:AdContact):string|null{
  const value=contact.value.trim();
  if(!value) return null;
  if(contact.type==="whatsapp") return `https://wa.me/${value.replace(/\D/g,"")}`;
  if(contact.type==="phone") return `tel:${value.replace(/[^\d+]/g,"")}`;
  return /^https?:\/\//i.test(value)?value:`https://${value}`;
}
export const REPUBLISH_COOLDOWN_MS=72*60*60*1000;
export function canRepublish(lastRepublishedAt?:string,nowMs=Date.now()){if(!lastRepublishedAt)return true;const value=new Date(lastRepublishedAt).getTime();return Number.isFinite(value)&&nowMs-value>=REPUBLISH_COOLDOWN_MS}
export type ModerationDecision="approved"|"changes_requested"|"rejected";
export function addDaysIso(iso:string,days:number){const value=new Date(iso).getTime();if(!Number.isFinite(value))throw new Error("INVALID_ISO_DATE");return new Date(value+days*24*60*60*1000).toISOString()}
export function transitionToPendingReview(ad:Ad,items:PromotionCode[]){if(ad.status!=="awaiting_payment")return ad;return{...ad,status:"pending_review" as const,promotions:[...new Set(items)]}}
export function moderatePendingAd(ad:Ad,decision:ModerationDecision,nowIso:string){if(ad.status!=="pending_review")return ad;const status:AdStatus=decision==="approved"?"active":decision;return{...ad,status,activatedAt:decision==="approved"?nowIso:ad.activatedAt,expiresAt:decision==="approved"?addDaysIso(nowIso,30):ad.expiresAt}}
export function extendAdPeriod(ad:Ad){if((ad.status!=="active"&&ad.status!=="paused")||!ad.expiresAt)return ad;return{...ad,expiresAt:addDaysIso(ad.expiresAt,15)}}
export function republishExpiredAd(ad:Ad,nowIso:string){const nowMs=new Date(nowIso).getTime();if(ad.status!=="expired"||!Number.isFinite(nowMs)||!canRepublish(ad.lastRepublishedAt,nowMs))return ad;return{...ad,status:"active" as const,lastRepublishedAt:nowIso,activatedAt:nowIso,expiresAt:addDaysIso(nowIso,30)}}
export const fallbackCities:City[]=[
  {id:"riyadh",ar:"الرياض",en:"Riyadh",region:"sa"},
  {id:"jeddah",ar:"جدة",en:"Jeddah",region:"sa"},
  {id:"makkah",ar:"مكة",en:"Makkah",region:"sa"},
  {id:"madinah",ar:"المدينة",en:"Madinah",region:"sa"},
  {id:"dammam",ar:"الدمام",en:"Dammam",region:"sa"},
  {id:"abha",ar:"أبها",en:"Abha",region:"sa"},
  {id:"jazan",ar:"جازان",en:"Jazan",region:"sa"},
  {id:"tabuk",ar:"تبوك",en:"Tabuk",region:"sa"},
  {id:"dubai",ar:"دبي",en:"Dubai",region:"ae"},
  {id:"abu-dhabi",ar:"أبوظبي",en:"Abu Dhabi",region:"ae"},
  {id:"sharjah",ar:"الشارقة",en:"Sharjah",region:"ae"},
  {id:"cairo",ar:"القاهرة",en:"Cairo",region:"eg"},
  {id:"giza",ar:"الجيزة",en:"Giza",region:"eg"},
  {id:"alexandria",ar:"الإسكندرية",en:"Alexandria",region:"eg"},
];
export const seedBrand:BrandProfile={id:"brand-e3lani",ownerId:"seed-owner",name:"إعلاني E3lani",slug:"e3lani",bio:"منصة الإعلانات المرئية لكل شيء في السعودية.",website:"https://example.com",logoAsset:"wordmark",verified:true,verificationStatus:"verified"};
export const seedAds:Ad[]=[
 {id:"AD10001",ownerId:"seed-owner",brandId:seedBrand.id,ownerName:"نخبة السيارات",title:"سيارة رياضية بتفاصيل استثنائية",description:"شاهد المواصفات وتواصل مباشرة مع المعلن.",categoryId:"cars",cityId:"riyadh",media:[{id:"m1",kind:"image",uri:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85"}],contacts:[{type:"store",value:""}],status:"active",revision:1,verified:true,featured:true,sponsored:false,createdAt:"2026-07-31T12:00:00.000Z",activatedAt:"2026-07-31T12:00:00.000Z",expiresAt:"2026-08-30T12:00:00.000Z",promotions:[]},
 {id:"AD10002",ownerId:"seed-owner",brandId:seedBrand.id,ownerName:"رِواق البن",title:"عرض اليوم من رِواق البن",description:"تجربة قهوة بطابع عصري ومحاصيل مختارة بعناية.",categoryId:"restaurants",cityId:"jeddah",media:[{id:"m2",kind:"image",uri:"https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85"}],contacts:[{type:"whatsapp",value:""}],status:"active",revision:1,verified:true,featured:false,sponsored:false,createdAt:"2026-07-31T11:00:00.000Z",activatedAt:"2026-07-31T11:00:00.000Z",expiresAt:"2026-08-30T11:00:00.000Z",promotions:[]},
 {id:"AD10003",ownerId:"seed-owner-ae",brandId:seedBrand.id,ownerName:"رؤية العقارية",title:"فيلا عصرية بموقع هادئ",description:"مساحات رحبة وتصميم حديث بالقرب من أهم الخدمات.",categoryId:"realestate",cityId:"dubai",media:[{id:"m3",kind:"image",uri:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"}],contacts:[{type:"phone",value:""}],status:"active",revision:1,verified:true,featured:false,sponsored:true,createdAt:"2026-07-30T16:00:00.000Z",activatedAt:"2026-07-30T16:00:00.000Z",expiresAt:"2026-08-29T16:00:00.000Z",promotions:["highlight_7"]}];
