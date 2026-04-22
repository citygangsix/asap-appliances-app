function uniqueZipCodes(zipCodes = []) {
  return [...new Set(zipCodes.map((zipCode) => normalizeZipCode(zipCode)).filter(Boolean))];
}

function mergeZipCodes(...groups) {
  return uniqueZipCodes(groups.flat());
}

export function normalizeZipCode(value) {
  const match = String(value ?? "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

export function extractZipCode(value) {
  return normalizeZipCode(value);
}

// These explicit coverage lists were compiled from public county/city ZIP listings
// for the requested Florida service areas so assignment stays deterministic offline.
export const CHRISTIAN_SERVICES_OCALA_ZIP_CODES = [
  "32702",
  "32113",
  "32134",
  "32179",
  "32182",
  "32183",
  "32192",
  "32195",
  "32617",
  "32664",
  "32681",
  "32686",
  "34420",
  "34421",
  "34430",
  "34431",
  "34432",
  "34470",
  "34471",
  "34472",
  "34473",
  "34474",
  "34475",
  "34476",
  "34477",
  "34478",
  "34479",
  "34480",
  "34481",
  "34482",
  "34483",
  "34488",
  "34489",
  "34491",
  "34492",
];

const PASCO_STANDARD_ZIP_CODES = [
  "33523",
  "33525",
  "33540",
  "33541",
  "33542",
  "33543",
  "33544",
  "33545",
  "33548",
  "33549",
  "33556",
  "33558",
  "33559",
  "33576",
  "33597",
  "34610",
  "34637",
  "34638",
  "34639",
  "34652",
  "34653",
  "34654",
  "34655",
  "34667",
  "34668",
  "34669",
  "34690",
  "34691",
];

const HERNANDO_STANDARD_ZIP_CODES = [
  "33523",
  "33597",
  "34601",
  "34602",
  "34604",
  "34606",
  "34607",
  "34608",
  "34609",
  "34613",
  "34614",
];

const PINELLAS_STANDARD_ZIP_CODES = [
  "33701",
  "33702",
  "33703",
  "33704",
  "33705",
  "33706",
  "33707",
  "33708",
  "33709",
  "33710",
  "33711",
  "33712",
  "33713",
  "33714",
  "33715",
  "33716",
  "33730",
  "33755",
  "33756",
  "33759",
  "33760",
  "33761",
  "33762",
  "33763",
  "33764",
  "33765",
  "33767",
  "33770",
  "33771",
  "33772",
  "33773",
  "33774",
  "33776",
  "33777",
  "33778",
  "33781",
  "33782",
  "33785",
  "33786",
  "34677",
  "34683",
  "34684",
  "34685",
  "34688",
  "34689",
  "34695",
  "34698",
];

const HILLSBOROUGH_STANDARD_ZIP_CODES = [
  "33510",
  "33511",
  "33527",
  "33534",
  "33540",
  "33547",
  "33548",
  "33549",
  "33556",
  "33558",
  "33559",
  "33563",
  "33565",
  "33566",
  "33567",
  "33569",
  "33570",
  "33572",
  "33573",
  "33578",
  "33579",
  "33584",
  "33592",
  "33594",
  "33596",
  "33598",
  "33602",
  "33603",
  "33604",
  "33605",
  "33606",
  "33607",
  "33609",
  "33610",
  "33611",
  "33612",
  "33613",
  "33614",
  "33615",
  "33616",
  "33617",
  "33618",
  "33619",
  "33621",
  "33624",
  "33625",
  "33626",
  "33629",
  "33634",
  "33635",
  "33637",
  "33647",
];

const MIAMI_DADE_STANDARD_ZIP_CODES = [
  "33010",
  "33012",
  "33013",
  "33014",
  "33015",
  "33016",
  "33018",
  "33030",
  "33031",
  "33032",
  "33033",
  "33034",
  "33035",
  "33054",
  "33055",
  "33056",
  "33109",
  "33122",
  "33125",
  "33126",
  "33127",
  "33128",
  "33129",
  "33130",
  "33131",
  "33132",
  "33133",
  "33134",
  "33135",
  "33136",
  "33137",
  "33138",
  "33139",
  "33140",
  "33141",
  "33142",
  "33143",
  "33144",
  "33145",
  "33146",
  "33147",
  "33149",
  "33150",
  "33154",
  "33155",
  "33156",
  "33157",
  "33158",
  "33160",
  "33161",
  "33162",
  "33165",
  "33166",
  "33167",
  "33168",
  "33169",
  "33170",
  "33172",
  "33173",
  "33174",
  "33175",
  "33176",
  "33177",
  "33178",
  "33179",
  "33180",
  "33181",
  "33182",
  "33183",
  "33184",
  "33185",
  "33186",
  "33187",
  "33189",
  "33190",
  "33193",
  "33194",
  "33196",
];

const BROWARD_STANDARD_ZIP_CODES = [
  "33004",
  "33009",
  "33019",
  "33020",
  "33021",
  "33023",
  "33024",
  "33025",
  "33026",
  "33027",
  "33028",
  "33029",
  "33060",
  "33062",
  "33063",
  "33064",
  "33065",
  "33066",
  "33067",
  "33068",
  "33069",
  "33071",
  "33073",
  "33076",
  "33301",
  "33304",
  "33305",
  "33306",
  "33308",
  "33309",
  "33311",
  "33312",
  "33313",
  "33314",
  "33315",
  "33316",
  "33317",
  "33319",
  "33321",
  "33322",
  "33323",
  "33324",
  "33325",
  "33326",
  "33327",
  "33328",
  "33330",
  "33331",
  "33332",
  "33334",
  "33351",
  "33441",
  "33442",
];

export const STEVEN_KNAPP_ZIP_CODES = mergeZipCodes(
  PASCO_STANDARD_ZIP_CODES,
  HERNANDO_STANDARD_ZIP_CODES,
  PINELLAS_STANDARD_ZIP_CODES,
  HILLSBOROUGH_STANDARD_ZIP_CODES,
);

export const JAMES_G_ZIP_CODES = mergeZipCodes(
  MIAMI_DADE_STANDARD_ZIP_CODES,
  BROWARD_STANDARD_ZIP_CODES,
);

export const DEXTER_ZIP_CODES = [...BROWARD_STANDARD_ZIP_CODES];

const TECHNICIAN_STATUS_PRIORITY = {
  unassigned: 0,
  en_route: 1,
  onsite: 2,
  late: 3,
};

export function getTechnicianCoverageZipCodes(technician) {
  return uniqueZipCodes(technician?.serviceZipCodes || []);
}

function compareMatchingTechnicians(left, right) {
  const statusDelta =
    (TECHNICIAN_STATUS_PRIORITY[left.statusToday] ?? Number.MAX_SAFE_INTEGER) -
    (TECHNICIAN_STATUS_PRIORITY[right.statusToday] ?? Number.MAX_SAFE_INTEGER);

  if (statusDelta !== 0) {
    return statusDelta;
  }

  const coverageDelta =
    getTechnicianCoverageZipCodes(left).length - getTechnicianCoverageZipCodes(right).length;

  if (coverageDelta !== 0) {
    return coverageDelta;
  }

  const scoreDelta = Number(right.score || 0) - Number(left.score || 0);

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return String(left.name || "").localeCompare(String(right.name || ""));
}

export function findMatchingTechniciansForZip(zipCode, technicians = []) {
  const normalizedZipCode = normalizeZipCode(zipCode);

  if (!normalizedZipCode) {
    return [];
  }

  return technicians
    .filter((technician) => getTechnicianCoverageZipCodes(technician).includes(normalizedZipCode))
    .sort(compareMatchingTechnicians);
}

export function findBestTechnicianForZip(zipCode, technicians = []) {
  return findMatchingTechniciansForZip(zipCode, technicians)[0] || null;
}
