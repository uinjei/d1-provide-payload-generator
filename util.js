const { readFile,writeFile } = require("fs/promises");
const nconf = require('nconf');

nconf.file({ file: './settings.json' });

const FD_LOCATION = nconf.get("FD_LOCATION")
const BPO_IDS = nconf.get("BPO_IDs")
const OUTPUT_FOLDER = nconf.get("OUTPUT_FOLDER")
const INCLUDE_ALL_SPO = nconf.get("INCLUDE_ALL_SPO")
const ALLOW_RANDOM_QTY = nconf.get("ALLOW_RANDOM_QTY")
const OFF_NET_3RD_PARTY_PROVIDER = nconf.get("OFF_NET_3RD_PARTY_PROVIDER")
const PRODUCT_OFFERS_WITH_PLACE = nconf.get("PRODUCT_OFFERS_WITH_PLACE")
const PRETTIFY = nconf.get("PRETTIFY");

const PRODUCT_OFFERING_FOLDER = "productOffering"
const PRODUCT_SPEC_FOLDER = "productSpecification"
const PRODUCT_OFFERING_GROUP_FOLDER = "productOfferingGroup"
const PRODUCT_PRICE_FOLDER = "price" 
const LOCALE = "en-US"
const CURRENCY = "defaultCurrency"


const toJSON = data => JSON.parse(data)
const getLocaleValue = (contents) => contents.find(content => LOCALE === content.locale).value
const getCurrency = (contents) => contents[CURRENCY]

const readJSONFile = (__filename) => readFile(__filename, { encoding: "utf8" }).then(toJSON)

const generateJSONFileLocation = (type, id) => `${FD_LOCATION}/${type}/${id}.json`

const writeToJSONFile = ({ name, currency, payload }) => writeFile(`${OUTPUT_FOLDER}/${name}_${currency}.json`, JSON.stringify(payload, null, PRETTIFY?4:0))

module.exports = {
    readJSONFile,
    getLocaleValue,
    getCurrency,
    generateJSONFileLocation,
    BPO_IDS,
    OUTPUT_FOLDER,
    PRODUCT_OFFERS_WITH_PLACE,
    INCLUDE_ALL_SPO,
    ALLOW_RANDOM_QTY,
    OFF_NET_3RD_PARTY_PROVIDER,
    PRODUCT_OFFERING_FOLDER,
    PRODUCT_SPEC_FOLDER,
    PRODUCT_OFFERING_GROUP_FOLDER,
    PRODUCT_PRICE_FOLDER,
    writeToJSONFile
}