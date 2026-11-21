import { getSessionId } from "../../utils/getSessionId";
import { getItemQuantity } from "./checkoutPageModel";
export function checkoutQuotePayload(
  state,
  derived,
  couponCode = state.appliedCoupon?.code || "",
) {
  const {
    customerCity,
    customerCityCode,
    customerCountry,
    customerEmailOrPhone,
    customerId,
    deliveryType,
    selectedRegion,
    storeCreditAmount,
    useStoreCredit,
  } = state;
  const { currentCart, selectedCountry } = derived;
  return {
    sessionId: getSessionId(),
    items: (currentCart || []).map((item) => ({
      productId: String(
        item.productId || item._id || item.id || item?.product?._id || "",
      ),
      title: item.title || item?.product?.title || "",
      image: item.image || item?.product?.image || "",
      color: item.color || "",
      size: item.size || "",
      variantId: item.variantId || item.variantKey || "",
      variantKey: item.variantKey || item.variantId || "",
      variantLabel: item.variantLabel || "",
      variantAttributes: Array.isArray(item.variantAttributes)
        ? item.variantAttributes
        : [],
      quantity: getItemQuantity(item),
      price: Number(item.price ?? item?.product?.price ?? 0),
      productType: item.productType || item?.product?.productType || "physical",
      requiresShipping:
        item.requiresShipping ?? item?.product?.requiresShipping ?? true,
      fulfillment: item.fulfillment || item?.product?.fulfillment || null,
    })),
    customer: {
      deliveryType,
      country: customerCountry,
      countryCode: selectedCountry?.code || "",
      department: selectedRegion,
      departmentCode: selectedRegion,
      city: customerCity,
      cityCode: customerCityCode,
      municipalityCode: customerCityCode,
      email: String(customerEmailOrPhone || "").includes("@")
        ? String(customerEmailOrPhone || "").trim()
        : "",
      emailOrPhone: customerEmailOrPhone,
      id: customerId,
      documentNumber: customerId,
    },
    customerDocument: customerId,
    channel: "web",
    couponCode,
    storeCreditAmount: useStoreCredit ? Number(storeCreditAmount || 0) : 0,
  };
}
export function checkoutQuoteKey(state, derived) {
  const { sessionId, ...payload } = checkoutQuotePayload(state, derived);
  return JSON.stringify({...payload,currency:state.paymentsConfig?.currency || 'COP'});
}
