import {
  Package,
  CreditCard,
  Truck,
  RefreshCw,
  CircleHelp,
  Heart,
  ShoppingBag,
  Tag,
} from "lucide-react";
export const helpIcon = (name) =>
  ({
    package: Package,
    "credit-card": CreditCard,
    truck: Truck,
    refresh: RefreshCw,
    help: CircleHelp,
    heart: Heart,
    "shopping-bag": ShoppingBag,
    tag: Tag,
  })[name] || CircleHelp;
