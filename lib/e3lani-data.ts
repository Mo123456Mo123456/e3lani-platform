export const BRAND={yellow:"#FFC400",yellowDark:"#E9AE00",black:"#111111",charcoal:"#252525",white:"#FFFFFF",surface:"#F7F7F7",border:"#E8E8E8",muted:"#6F6F6F",success:"#18864B",warning:"#C86A00",error:"#C9352B"} as const;
export type Locale="ar"|"en"; export type AccountType="viewer"|"advertiser"|"brand"; export type StaffRole="user"|"reviewer"|"support"|"finance"|"admin"|"owner";
export type AdStatus="draft"|"awaiting_payment"|"pending_review"|"changes_requested"|"active"|"paused"|"rejected"|"expired"|"removed";
export type ContactType="store"|"product"|"whatsapp"|"phone"|"external"; export type PromotionCode="highlight_3"|"highlight_7"|"top_category"|"city_targeting";
export type LaunchMode="PROFILE_ONLY"|"FREE_LAUNCH"|"PAID_ONLY";
export type FeedMode="forYou"|"near"|"latest";
export type Category={id:string;ar:string;en:string;icon:string}; export type City={id:string;ar:string;en:string;region:string};
export type AdMedia={id:string;kind:"image"|"video";uri:string;mediaAssetId?:number;processingStatus?:"processing"|"ready"|"failed";localAsset?:"poster"|"wordmark"|"icon"}; export type AdContact={type:ContactType;value:string};
export type Ad={id:string;ownerId:string;brandId?:string;ownerName?:string;title:string;description:string;categoryId:string;cityId:string;media:AdMedia[];contacts:AdContact[];status:AdStatus;revision:number;verified:boolean;featured:boolean;sponsored:boolean;createdAt:string;activatedAt?:string;expiresAt?:string;lastRepublishedAt?:string;promotions:PromotionCode[]};
export type ProfilePost={id:string;ownerId:string;title:string;text:string;mediaUri?:string;createdAt:string};
export type UserProfile={id:string;name:string;phone:string;email?:string;cityId:string;accountType:AccountType;role:StaffRole;bio?:string;avatarUri?:string};
export type BrandProfile={id:string;ownerId:string;name:string;slug:string;bio:string;website?:string;logoAsset?:"wordmark"|"icon";verified:boolean;verificationStatus:"unverified"|"pending"|"verified"|"rejected"};
export type Metrics={impressions:number;views:number;saves:number;shares:number;contacts:number}; export type NotificationItem={id:string;title:string;body:string;read:boolean;createdAt:string;kind:"payment"|"review"|"expiry"|"system"};
export type ReportItem={id:string;adId:string;reason:string;details?:string;status:"open"|"resolved";createdAt:string}; export type Order={id:string;adId:string;items:PromotionCode[];totalHalalas:number;status:"pending"|"paid"|"failed"|"refunded";provider:"sandbox"|"external";createdAt:string};
export type Invoice={id:string;orderId:string;number:string;totalHalalas:number;issuedAt:string}; export type AuditLog={id:string;actor:string;action:string;target:string;reason:string;createdAt:string};
export const REPUBLISH_COOLDOWN_MS=72*60*60*1000;
export function canRepublish(lastRepublishedAt?:string,nowMs=Date.now()){if(!lastRepublishedAt)return true;const value=new Date(lastRepublishedAt).getTime();return Number.isFinite(value)&&nowMs-value>=REPUBLISH_COOLDOWN_MS}
export type ModerationDecision="approved"|"changes_requested"|"rejected";
export function addDaysIso(iso:string,days:number){const value=new Date(iso).getTime();if(!Number.isFinite(value))throw new Error("INVALID_ISO_DATE");return new Date(value+days*24*60*60*1000).toISOString()}
export function transitionToPendingReview(ad:Ad,items:PromotionCode[]){if(ad.status!=="awaiting_payment")return ad;return{...ad,status:"pending_review" as const,promotions:[...new Set(items)]}}
export function moderatePendingAd(ad:Ad,decision:ModerationDecision,nowIso:string){if(ad.status!=="pending_review")return ad;const status:AdStatus=decision==="approved"?"active":decision;return{...ad,status,activatedAt:decision==="approved"?nowIso:ad.activatedAt,expiresAt:decision==="approved"?addDaysIso(nowIso,30):ad.expiresAt}}
export function extendAdPeriod(ad:Ad){if((ad.status!=="active"&&ad.status!=="paused")||!ad.expiresAt)return ad;return{...ad,expiresAt:addDaysIso(ad.expiresAt,15)}}
export function republishExpiredAd(ad:Ad,nowIso:string){const nowMs=new Date(nowIso).getTime();if(ad.status!=="expired"||!Number.isFinite(nowMs)||!canRepublish(ad.lastRepublishedAt,nowMs))return ad;return{...ad,status:"active" as const,lastRepublishedAt:nowIso,activatedAt:nowIso,expiresAt:addDaysIso(nowIso,30)}}

/** Default product mode: free home distribution during launch. */
export const DEFAULT_LAUNCH_MODE: LaunchMode = "FREE_LAUNCH";

export function shouldPublishFree(mode: LaunchMode = DEFAULT_LAUNCH_MODE, _promotions: PromotionCode[] = []) {
  return mode === "FREE_LAUNCH";
}

export function applyLaunchPublish(
  ad: Omit<Ad, "status" | "activatedAt" | "expiresAt"> & Partial<Pick<Ad, "status" | "activatedAt" | "expiresAt">>,
  mode: LaunchMode = DEFAULT_LAUNCH_MODE,
  nowIso = new Date().toISOString(),
): Ad {
  const free = mode === "FREE_LAUNCH" && (ad.promotions?.length ?? 0) === 0;
  if (free) {
    return {
      ...ad,
      status: "active",
      activatedAt: nowIso,
      expiresAt: addDaysIso(nowIso, 30),
      promotions: ad.promotions ?? [],
    } as Ad;
  }
  return {
    ...ad,
    status: ad.status ?? "awaiting_payment",
    promotions: ad.promotions ?? [],
  } as Ad;
}

export function scoreForYou(ad: Ad, views = 0) {
  return (ad.featured ? 1 : 0) + (ad.sponsored ? 0.45 : 0) + views / 100000;
}

export function sortFeedAds(
  ads: Ad[],
  mode: FeedMode,
  options: { marketCityIds?: string[]; viewsById?: Record<string, number>; categoryId?: string } = {},
) {
  let next = ads.filter((ad) => ad.status === "active");
  if (options.categoryId) {
    next = next.filter((ad) => ad.categoryId === options.categoryId);
  }
  if (mode === "near" && options.marketCityIds?.length) {
    const allowed = new Set(options.marketCityIds);
    next = next.filter((ad) => allowed.has(ad.cityId));
  }
  if (mode === "latest") {
    return [...next].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  if (mode === "forYou") {
    const views = options.viewsById ?? {};
    return [...next].sort((a, b) => scoreForYou(b, views[b.id] ?? 0) - scoreForYou(a, views[a.id] ?? 0));
  }
  return next;
}

export function contactLabel(type: ContactType, locale: Locale = "ar") {
  const ar: Record<ContactType, string> = {
    whatsapp: "تواصل عبر واتساب",
    phone: "اتصال بالمعلن",
    store: "زيارة المتجر",
    product: "صفحة المنتج",
    external: "فتح الرابط",
  };
  const en: Record<ContactType, string> = {
    whatsapp: "WhatsApp",
    phone: "Call advertiser",
    store: "Visit store",
    product: "Product page",
    external: "Open link",
  };
  return (locale === "ar" ? ar : en)[type];
}

export const seedBrand:BrandProfile={id:"brand-e3lani",ownerId:"seed-owner",name:"إعلاني E3lani",slug:"e3lani",bio:"منصة الإعلانات المرئية لكل شيء في السعودية.",website:"https://example.com",logoAsset:"wordmark",verified:true,verificationStatus:"verified"};
export const seedAds:Ad[]=[
 {id:"AD10001",ownerId:"seed-owner",brandId:seedBrand.id,ownerName:"نخبة السيارات",title:"سيارة رياضية بتفاصيل استثنائية",description:"شاهد المواصفات وتواصل مباشرة مع المعلن.",categoryId:"cars",cityId:"riyadh",media:[{id:"m1",kind:"image",uri:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85"}],contacts:[{type:"store",value:""}],status:"active",revision:1,verified:true,featured:true,sponsored:false,createdAt:"2026-07-31T12:00:00.000Z",activatedAt:"2026-07-31T12:00:00.000Z",expiresAt:"2026-08-30T12:00:00.000Z",promotions:[]},
 {id:"AD10002",ownerId:"seed-owner",brandId:seedBrand.id,ownerName:"رِواق البن",title:"عرض اليوم من رِواق البن",description:"تجربة قهوة بطابع عصري ومحاصيل مختارة بعناية.",categoryId:"restaurants",cityId:"jeddah",media:[{id:"m2",kind:"image",uri:"https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85"}],contacts:[{type:"whatsapp",value:""}],status:"active",revision:1,verified:true,featured:false,sponsored:false,createdAt:"2026-07-31T11:00:00.000Z",activatedAt:"2026-07-31T11:00:00.000Z",expiresAt:"2026-08-30T11:00:00.000Z",promotions:[]},
 {id:"AD10003",ownerId:"seed-owner",brandId:seedBrand.id,ownerName:"رؤية العقارية",title:"فيلا عصرية بموقع هادئ",description:"مساحات رحبة وتصميم حديث بالقرب من أهم الخدمات.",categoryId:"real_estate",cityId:"dubai",media:[{id:"m3",kind:"image",uri:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85"}],contacts:[{type:"phone",value:""}],status:"active",revision:1,verified:true,featured:false,sponsored:true,createdAt:"2026-07-30T16:00:00.000Z",activatedAt:"2026-07-30T16:00:00.000Z",expiresAt:"2026-08-29T16:00:00.000Z",promotions:["highlight_3"]},
];
