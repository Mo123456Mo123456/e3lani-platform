import { readFileSync, writeFileSync } from "node:fs";

const path = "app/create-ad.tsx";
let source = readFileSync(path, "utf8");

function replaceExactly(before, after, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected one match, found ${occurrences}`);
  }
  source = source.replace(before, after);
}

replaceExactly(
  `  const [customCity, setCustomCity] = useState("");
  const [adCountry, setAdCountry] = useState(store.accountCountry);
  const [storeUrl, setStoreUrl] = useState("");`,
  `  const [customCity, setCustomCity] = useState("");
  const [adCountry, setAdCountry] = useState(store.accountCountry);
  const countryCitiesQuery = trpc.countries.cities.useQuery(
    { countryCode: adCountry },
    { enabled: Boolean(adCountry), staleTime: 30 * 60 * 1000 },
  );
  const availableCities = countryCitiesQuery.data;
  const [storeUrl, setStoreUrl] = useState("");`,
  "country cities query",
);

replaceExactly(
  `  useEffect(() => {
    if (!categoryId && productData.categories[0]) setCategoryId(productData.categories[0].id);
    if (!cityId && productData.cities[0]) setCityId(productData.cities[0].id);
  }, [categoryId, cityId, productData.categories, productData.cities]);`,
  `  useEffect(() => {
    if (!categoryId && productData.categories[0]) setCategoryId(productData.categories[0].id);
    if (!cityId && availableCities?.[0]) setCityId(availableCities[0].code);
  }, [availableCities, categoryId, cityId, productData.categories]);`,
  "default selected city",
);

replaceExactly(
  `  if (productData.isLoading) {`,
  `  if (productData.isLoading || countryCitiesQuery.isLoading) {`,
  "loading guard",
);

replaceExactly(
  `    productData.isError ||
    !productData.config ||
    !productData.categories.length ||
    !productData.cities.length`,
  `    productData.isError ||
    countryCitiesQuery.isError ||
    !productData.config ||
    !productData.categories.length ||
    !availableCities?.length`,
  "catalog error guard",
);

replaceExactly(
  `        cityCode: cityId === "other" ? "other" : cityId,
        customCityName: cityId === "other" ? customCity.trim() || null : null,`,
  `        cityCode: cityId,
        customCityName: cityId.startsWith("other") ? customCity.trim() || null : null,`,
  "publish city payload",
);

replaceExactly(
  `  const city = productData.cities.find((item) => item.id === cityId);
  const cityName =
    cityId === "other"
      ? customCity.trim() || (locale === "ar" ? "مدينة أخرى" : "Other city")
      : locale === "ar"
        ? city?.ar
        : city?.en;`,
  `  const city = availableCities?.find((item) => item.code === cityId);
  const cityName =
    cityId.startsWith("other")
      ? customCity.trim() || (locale === "ar" ? "مدينة أخرى" : "Other city")
      : locale === "ar"
        ? city?.nameAr
        : city?.nameEn;`,
  "city summary",
);

replaceExactly(
  `                  onPress={() => setAdCountry(country.code)}
`,
  `                  onPress={() => {
                    setAdCountry(country.code);
                    setCityId("");
                    setCustomCity("");
                  }}
`,
  "country selection reset",
);

replaceExactly(
  `              {productData.cities.map((item) => (
                <Pill
                  key={item.id}
                  label={locale === "ar" ? item.ar : item.en}
                  active={cityId === item.id}
                  onPress={() => setCityId(item.id)}
                />
              ))}
              <Pill
                label={locale === "ar" ? "مدينة أخرى" : "Other city"}
                active={cityId === "other"}
                onPress={() => setCityId("other")}
              />`,
  `              {(availableCities ?? []).map((item) => (
                <Pill
                  key={item.code}
                  label={locale === "ar" ? item.nameAr : item.nameEn}
                  active={cityId === item.code}
                  onPress={() => setCityId(item.code)}
                />
              ))}`,
  "country city pills",
);

replaceExactly(
  `            {cityId === "other" ? (`,
  `            {cityId.startsWith("other") ? (`,
  "custom city field",
);

writeFileSync(path, source);
console.log("Country-specific city UI patch applied.");
