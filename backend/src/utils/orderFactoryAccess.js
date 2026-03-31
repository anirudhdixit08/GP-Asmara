
export function orderBelongsToFactoryUser(order, user) {
  if (!order || user.role !== "factory") return false;
  const f = order.factory;
  if (typeof f === "string" && user.organisationName) {
    return f.trim().toLowerCase() === user.organisationName.trim().toLowerCase();
  }
  return false;
}
