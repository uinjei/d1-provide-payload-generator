const {
    readJSONFile,
    generateJSONFileLocation,
    PRODUCT_SPEC_FOLDER,
    PRODUCT_OFFERING_FOLDER,
    PRODUCT_OFFERING_GROUP_FOLDER,
    ALLOW_RANDOM_QTY,
    INCLUDE_ALL_SPO,
    OFF_NET_3RD_PARTY_PROVIDER,
    getLocaleValue,
    PRODUCT_OFFERS_WITH_PLACE
} = require("./util")

const ROOT_TYPE = "ROOT_TYPE"
const BUNDLE_PRODUCT_TYPE = "BUNDLE_PRODUCT_TYPE"
const SIMPLE_PRODUCT_TYPE = "SIMPLE_PRODUCT_TYPE"
const STRING_TYPE = "String"
const INTEGER_TYPE = "Integer"

const addBillingAccountField = payload => payload.billingAccount = {
    id: "{{billing}}"
}

const addExternalIdentifierField = (payload, type, orderCount) => {

    const externalIdentifier = []

    switch (type) {
        case BUNDLE_PRODUCT_TYPE:
            externalIdentifier.push({
                id: "Vlocity_OrderItemID",
                type: "VlocityOrderItem"
            })
            break;
        case SIMPLE_PRODUCT_TYPE:
            externalIdentifier.push({
                id: `Vlocity_OrderItemID_${orderCount}`,
                type: "VlocityOrderItem"
            })
            externalIdentifier.push({
                "id": `NCSOM_OrderItemID_${orderCount}`,
                "type": "NCSOM Product"
            })
            break;
        case ROOT_TYPE:
        default:
            externalIdentifier.push({
                "id": "Vlocity_OrderID",
                "type": "VlocityOrder"
            })
            externalIdentifier.push({
                "id": "NCSOM_OrderID",
                "type": "NCSOM External"
            })
    }

    payload.externalIdentifier = externalIdentifier
}

const createBasicPayload = () => {
    const payload = {
        relatedParty: [
            {
                role: "customer",
                id: "{{CustomerId}}"
            }
        ],
        orderItem: []
    }
    addBillingAccountField(payload)
    addExternalIdentifierField(payload, ROOT_TYPE)

    return payload
}

const createMainOrder = (mainProductOfferingId, cardinality) => {

    const mainOrder = createBaseOrderItem(mainProductOfferingId, cardinality)

    addBillingAccountField(mainOrder)
    addExternalIdentifierField(mainOrder, BUNDLE_PRODUCT_TYPE)

    return mainOrder
}

const generateValue = (type) => {
    switch (type) {
        case STRING_TYPE:
            return "Random String"
            break;
        case INTEGER_TYPE:
            return generateRandomNumber(1, 100)
    }
}

const selectValueFromProductOfferDefinedProductSpecCharValues = async (productOfferId) => {

    const characteristic = []

    const __filename = generateJSONFileLocation(PRODUCT_OFFERING_FOLDER, productOfferId)
    const { prodSpecCharValueUse, productSpecification, productOfferingTerm, localizedName } = await readJSONFile(__filename)

    const place = PRODUCT_OFFERS_WITH_PLACE.includes(getLocaleValue(localizedName)) ? generatePlace(): null


    prodSpecCharValueUse.forEach(({ name, characteristicValue, valueType }) => {
        characteristic.push({
            name,
            value: characteristicValue.length ?
            characteristicValue[generateRandomNumber(0, characteristicValue.length - 1)].value
            : generateValue(valueType)
        })
    })

    return {
        characteristic,
        productSpecification,
        productOfferingTerm,
        place
    }
}

const generatePlace = () => ([
    {
        "role": "installation",
        "name": "installation",
        "id": "{{installation}}"
    }
])

const selectValueFromProductSpecCharValues = async (productSpecId, characteristic, onNetIndicator) => {

    const __filename = generateJSONFileLocation(PRODUCT_SPEC_FOLDER, productSpecId)
    const productSpec = await readJSONFile(__filename)

    const addedCharacteristics = characteristic.map(({ name }) => name)

    productSpec.productSpecCharacteristic
        .filter(({ name }) => !addedCharacteristics.includes(name))
        .forEach(({ name, valueType, productSpecCharacteristicValue }) => {
            if (name === "ipAddress")
                characteristic.push({
                    name,
                    value: "10.10.10.10"
                })
            else if (name === "onNetIndicator" && productSpecCharacteristicValue.length) {
                characteristic.push({
                    name,
                    value: productSpecCharacteristicValue[onNetIndicator].value
                })
            } else
                characteristic.push({
                    name,
                    value: productSpecCharacteristicValue.length ?
                        productSpecCharacteristicValue[generateRandomNumber(0, productSpecCharacteristicValue.length - 1)].value
                        : generateValue(valueType)
                })
        })

    return characteristic
}

const selectProductsFromOfferGroup = (productOfferingsInGroup, min, max, defaultValue) => {

    const cardinality = {
        min,
        max,
        default: defaultValue
    }

    const quantity = generateQuantity(cardinality)

    let currentOffers = productOfferingsInGroup.filter(productOffering => !productOffering.expiredForSales)
    const selectedOffers = []

    for (let i = 0; i < quantity; i++) {
        const selectedIndex = generateRandomNumber(0, currentOffers.length - 1)
        selectedOffers.push(currentOffers[selectedIndex])
    }

    return selectedOffers

}

const convertOfferGroupToProductOffering = (offerGroup) => {
    const selectedOffers = offerGroup.flat()
    const uniqueOffers = [...new Set(selectedOffers)].map(uniqueOffer => {
        const count = selectedOffers.filter(selectedOffer => selectedOffer.id === uniqueOffer.id).length

        return {
            bundledProdOfferOption: {
                defaultRelOfferNumber: count,
                numberRelOfferLowerLimit: count,
                numberRelOfferUpperLimit: count
            },
            expiredForSales: false,
            id: uniqueOffer.id,
            groupOptionId: uniqueOffer.groupOptionId
        }
    })

    return uniqueOffers
}

const isLastMileOrAdditionalEquipment = (offer) => {
    return offer.name[0].value !== "Select Last Mile Equipment" && offer.name[0].value !== "Select Additional Equipment"
}


const generateOfferGroupOrder = (offerGroup) => {

    let offers = OFF_NET_3RD_PARTY_PROVIDER ? offerGroup.filter(isLastMileOrAdditionalEquipment) : offerGroup

    return Promise.all(offers.map(async productOffer => {

        const { bundledGroupPolicy, groupOptionId, numberRelOfferLowerLimit, numberRelOfferUpperLimit } = productOffer

        const __filename = generateJSONFileLocation(PRODUCT_OFFERING_GROUP_FOLDER, productOffer.bundledGroupPolicy.id)
        const offerGroup = await readJSONFile(__filename)
        const selectedOrders = selectProductsFromOfferGroup(offerGroup.productOfferingsInGroup,
            numberRelOfferLowerLimit,
            numberRelOfferUpperLimit,
            bundledGroupPolicy.defaultRelOfferNumber
        )

        selectedOrders.forEach(selectedOrder => selectedOrder.groupOptionId = groupOptionId)
        return selectedOrders
    })).then(convertOfferGroupToProductOffering)

}


const addItemTerm = (productOfferingTerm) => {

    const index = generateRandomNumber(0, productOfferingTerm.length - 1)
    const selectedTerm = productOfferingTerm[index]

    return {
        duration: selectedTerm.duration,
        policyId: selectedTerm.policy.id,
        "@type": selectedTerm.type,
        name: selectedTerm.name
    }
}

const createProductDetails = async (productOfferId, onNetIndicator) => {

    const { characteristic, productSpecification, productOfferingTerm, place } = await selectValueFromProductOfferDefinedProductSpecCharValues(productOfferId)
    await selectValueFromProductSpecCharValues(productSpecification.id, characteristic, onNetIndicator)


    const itemTerm = []
    if (productOfferingTerm.length > 0) {
        itemTerm.push(addItemTerm(productOfferingTerm))
    }

    const product = {
        productSpecification,
        characteristic,
        place
    }

    if(!place) delete product.place

    return {
        product,
        itemTerm
    }
}

const selectOnNetIndicator = (is3rdParty) => is3rdParty ? 1 : 0

const addGroupOptionId = (orderItem, groupOptionId) => orderItem.productOfferingGroupOption = { groupOptionId }

const createOrderItems = (productOfferings, onNetIndicator) => {
    return Promise.all(productOfferings.map(async ({ id, bundledProdOfferOption, groupOptionId }, index) => {

        const cardinality = {
            min: bundledProdOfferOption.numberRelOfferLowerLimit,
            max: bundledProdOfferOption.numberRelOfferUpperLimit,
            default: bundledProdOfferOption.defaultRelOfferNumber
        }

        const orderItem = createBaseOrderItem(id, cardinality)
        if (!orderItem) return

        addExternalIdentifierField(orderItem, SIMPLE_PRODUCT_TYPE, index + 1)

        if (groupOptionId) addGroupOptionId(orderItem, groupOptionId)

        const productDetails = await createProductDetails(id, onNetIndicator)
        orderItem.product = productDetails.product
        if (productDetails.itemTerm.length > 0) orderItem.itemTerm = productDetails.itemTerm

        if (orderItem.product.productSpecification.id === "a0bba909-01a0-4ab7-87d1-bdfe3e6329bd") addNextActionField(orderItem)

        return orderItem
    })).then(orderItems => orderItems.filter(orderItem => orderItem))
}

const addNextActionField = orderItem => orderItem.nextAction = [
    {
        "durationPolicy": {
            "duration": {
                "amount": 2,
                "units": "Months"
            },
            "startDatePolicy": "activationDate"
        },
        "action": "terminate",
        "nextActionType": "customerDefined",
        "extensions": {
            "requestType": "Future"
        }
    }
]

const generateRandomNumber = (min, max) => Math.floor(Math.random() * max) + min

const generateQuantity = (cardinality) => {

    let quantity = 1
    if (!cardinality) return quantity

    if (cardinality && ALLOW_RANDOM_QTY) {
        let min = INCLUDE_ALL_SPO ? 1 : cardinality.min || cardinality.default
        quantity = generateRandomNumber(min, cardinality.max)
    } else if (cardinality && !ALLOW_RANDOM_QTY) {
        let min = INCLUDE_ALL_SPO ? 1 : cardinality.min || cardinality.default
        quantity = min
    }

    return quantity + ""
}

const createBaseOrderItem = (productOfferingId, cardinality) => {

    const quantity = generateQuantity(cardinality)

    if (quantity == 0) return false

    return {
        extensions: {
            reservationId: "123"//leave as is
        },
        quantity,
        productOffering: {
            id: productOfferingId
        },
        action: "add",
        modifyReason: [
            {
                name: "CREQ",
                action: "add"
            }
        ]
    }
}


module.exports = {
    createBasicPayload,
    createMainOrder,
    createOrderItems,
    generateOfferGroupOrder,
    selectOnNetIndicator
}