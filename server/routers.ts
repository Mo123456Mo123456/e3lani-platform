import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  product: router({
    config: publicProcedure.query(() => ({
      appName: "إعلاني | E3lani",
      currency: "SAR",
      finalBasePriceHalalas: 5900,
      vatBasisPoints: 1500,
      activeDurationDays: 30,
      republishCooldownHours: 72,
      paymentMode: "sandbox" as const,
      paymentDisclaimer: "Sandbox only. Production requires a live provider and server-side receipt verification.",
    })),
    catalog: publicProcedure.query(() => ({
      categories: [
        { id: "cars", nameAr: "السيارات", nameEn: "Cars" },
        { id: "real-estate", nameAr: "العقارات", nameEn: "Real estate" },
        { id: "electronics", nameAr: "الإلكترونيات", nameEn: "Electronics" },
        { id: "furniture", nameAr: "الأثاث", nameEn: "Furniture" },
        { id: "services", nameAr: "الخدمات", nameEn: "Services" },
        { id: "brands", nameAr: "البراندات", nameEn: "Brands" },
      ],
      cities: [
        { id: "riyadh", nameAr: "الرياض", nameEn: "Riyadh" },
        { id: "jeddah", nameAr: "جدة", nameEn: "Jeddah" },
        { id: "dammam", nameAr: "الدمام", nameEn: "Dammam" },
        { id: "makkah", nameAr: "مكة المكرمة", nameEn: "Makkah" },
        { id: "madinah", nameAr: "المدينة المنورة", nameEn: "Madinah" },
      ],
    })),
  }),
});

export type AppRouter = typeof appRouter;
