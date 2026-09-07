export interface Country {
  name: string
  code: string
}

export const COUNTRIES: Country[] = [
  { name: "Nigeria", code: "NG" },
  { name: "Ghana", code: "GH" },
  { name: "Kenya", code: "KE" },
  { name: "South Africa", code: "ZA" },
  { name: "United Kingdom", code: "GB" },
  { name: "United States", code: "US" },
]

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo",
  "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa",
  "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba",
  "Yobe", "Zamfara",
]

const GHANA_REGIONS = [
  "Ashanti", "Brong-Ahafo", "Central", "Eastern", "Greater Accra", "Northern", "Oti",
  "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North",
]

const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos",
  "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya",
  "Taita-Taveta", "Tana River", "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu",
  "Vihiga", "Wajir", "West Pokot",
]

const SA_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga",
  "North West", "Northern Cape", "Western Cape",
]

const UK_COUNTRIES = ["England", "Northern Ireland", "Scotland", "Wales"]

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming",
]

export const STATES: Record<string, string[]> = {
  Nigeria: NIGERIAN_STATES,
  Ghana: GHANA_REGIONS,
  Kenya: KENYA_COUNTIES,
  "South Africa": SA_PROVINCES,
  "United Kingdom": UK_COUNTRIES,
  "United States": US_STATES,
}

const NIGERIAN_CITIES: Record<string, string[]> = {
  Abia: ["Aba", "Umuahia", "Ohafia", "Arochukwu"],
  Adamawa: ["Yola", "Mubi", "Jimeta", "Numan"],
  "Akwa Ibom": ["Uyo", "Eket", "Ikot Ekpene", "Oron"],
  Anambra: ["Awka", "Onitsha", "Nnewi", "Ekwulobia"],
  Bauchi: ["Bauchi", "Azare", "Jama'are", "Misau"],
  Bayelsa: ["Yenagoa", "Brass", "Ogbia"],
  Benue: ["Makurdi", "Gboko", "Otukpo", "Katsina-Ala"],
  Borno: ["Maiduguri", "Biu", "Bama"],
  "Cross River": ["Calabar", "Ikom", "Ogoja", "Ugep"],
  Delta: ["Asaba", "Warri", "Sapele", "Ughelli"],
  Ebonyi: ["Abakaliki", "Afikpo", "Onueke"],
  Edo: ["Benin City", "Auchi", "Ekpoma", "Igarra"],
  Ekiti: ["Ado-Ekiti", "Ikere-Ekiti", "Iworoko"],
  Enugu: ["Enugu", "Nsukka", "Agbani", "Udi"],
  FCT: ["Abuja", "Gwagwalada", "Kuje", "Bwari"],
  Gombe: ["Gombe", "Kaltungo", "Bajoga"],
  Imo: ["Owerri", "Orlu", "Okigwe", "Mbaise"],
  Jigawa: ["Dutse", "Hadejia", "Gumel"],
  Kaduna: ["Kaduna", "Zaria", "Kafanchan"],
  Kano: ["Kano", "Bichi", "Kibiya", "Gaya"],
  Katsina: ["Katsina", "Daura", "Funtua"],
  Kebbi: ["Birnin Kebbi", "Argungu", "Yelwa"],
  Kogi: ["Lokoja", "Anyigba", "Okene", "Idah"],
  Kwara: ["Ilorin", "Offa", "Jebba", "Omu-Aran"],
  Lagos: ["Ikeja", "Lekki", "Victoria Island", "Yaba", "Ikorodu", "Badagry"],
  Nasarawa: ["Lafia", "Keffi", "Akwanga", "Nasarawa"],
  Niger: ["Minna", "Bida", "Suleja", "Kontagora"],
  Ogun: ["Abeokuta", "Ijebu-Ode", "Sagamu", "Ilaro"],
  Ondo: ["Akure", "Ondo", "Owo", "Ore"],
  Osun: ["Osogbo", "Ile-Ife", "Ilesa", "Ede"],
  Oyo: ["Ibadan", "Ogbomosho", "Iseyin", "Oyo"],
  Plateau: ["Jos", "Bukuru", "Pankshin", "Langtang"],
  Rivers: ["Port Harcourt", "Obio-Akpor", "Bonny", "Bori"],
  Sokoto: ["Sokoto", "Tambuwal", "Gwadabawa"],
  Taraba: ["Jalingo", "Wukari", "Bali"],
  Yobe: ["Damaturu", "Potiskum", "Nguru"],
  Zamfara: ["Gusau", "Kaura Namoda", "Tsafe"],
}

const GHANA_CITIES: Record<string, string[]> = {
  Ashanti: ["Kumasi", "Obuasi"],
  Central: ["Cape Coast", "Winneba"],
  Eastern: ["Koforidua"],
  "Greater Accra": ["Accra", "Tema"],
  Northern: ["Tamale"],
  Oti: ["Dambai"],
  Savannah: ["Bole"],
  "Upper East": ["Bolgatanga"],
  "Upper West": ["Wa"],
  Volta: ["Ho"],
  Western: ["Takoradi", "Sekondi"],
  "Western North": ["Sefwi Wiawso"],
  "Brong-Ahafo": ["Sunyani"],
}

const KENYA_CITIES: Record<string, string[]> = {
  Nairobi: ["Nairobi"],
  Mombasa: ["Mombasa"],
  Kisumu: ["Kisumu"],
  Nakuru: ["Nakuru"],
  UasinGishu: ["Eldoret"],
  Kiambu: ["Thika", "Kiambu"],
  Kajiado: ["Ngong", "Kajiado"],
  Machakos: ["Machakos"],
  Murang_a: ["Murang'a"],
  Kirinyaga: ["Kerugoya"],
  Embu: ["Embu"],
  Nyeri: ["Nyeri"],
}

const SA_CITIES: Record<string, string[]> = {
  Gauteng: ["Johannesburg", "Pretoria"],
  "Western Cape": ["Cape Town"],
  "KwaZulu-Natal": ["Durban"],
  "Eastern Cape": ["Port Elizabeth", "East London"],
  "Free State": ["Bloemfontein"],
  Limpopo: ["Polokwane"],
  Mpumalanga: ["Nelspruit"],
  "North West": ["Rustenburg"],
  "Northern Cape": ["Kimberley"],
}

const UK_CITIES: Record<string, string[]> = {
  England: ["London", "Manchester", "Birmingham", "Liverpool", "Leeds"],
  Scotland: ["Glasgow", "Edinburgh", "Aberdeen"],
  Wales: ["Cardiff", "Swansea"],
  "Northern Ireland": ["Belfast"],
}

const US_CITIES: Record<string, string[]> = {
  California: ["Los Angeles", "San Francisco"],
  Texas: ["Houston", "Dallas"],
  "New York": ["New York City"],
  Florida: ["Miami"],
  Illinois: ["Chicago"],
  Georgia: ["Atlanta"],
  Washington: ["Seattle"],
  Arizona: ["Phoenix"],
  Colorado: ["Denver"],
  Massachusetts: ["Boston"],
  Pennsylvania: ["Philadelphia"],
  Nevada: ["Las Vegas"],
  Michigan: ["Detroit"],
  Ohio: ["Columbus", "Cleveland"],
  Maryland: ["Baltimore"],
}

export const CITIES: Record<string, Record<string, string[]>> = {
  Nigeria: NIGERIAN_CITIES,
  Ghana: GHANA_CITIES,
  Kenya: KENYA_CITIES,
  "South Africa": SA_CITIES,
  "United Kingdom": UK_CITIES,
  "United States": US_CITIES,
}

export function getStatesForCountry(country: string): string[] {
  return STATES[country] || []
}

export function getCitiesForState(country: string, state: string): string[] {
  if (!country || !state) return []
  return CITIES[country]?.[state] || []
}

// Backward-compatible aliases used by business forms.
export function statesForCountry(country: string): string[] {
  return getStatesForCountry(country)
}

export function citiesForState(country: string, state: string): string[] {
  return getCitiesForState(country, state)
}
