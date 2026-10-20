export type GuideIconName =
  | "car"
  | "parts"
  | "finder"
  | "request"
  | "bike"
  | "duty"
  | "account"
  | "chat"
  | "policies";

export type GuideAccent = "brand" | "gear" | "finder";

export type GuideMockKind =
  | "header"
  | "home"
  | "inventory"
  | "car-detail"
  | "checkout"
  | "parts"
  | "parts-finder"
  | "request-car"
  | "request-parts"
  | "motorcycles"
  | "duty"
  | "dashboard"
  | "ghana-card"
  | "wallet"
  | "receipts"
  | "chat-gate"
  | "chat-thread"
  | "policies";

export type GuideStep = {
  id: string;
  title: string;
  /** Exact control the guest should tap next. */
  tap: string;
  detail: string;
  mock: GuideMockKind;
  highlight: string;
  route: string;
  routeLabel: string;
  needsAccount?: boolean;
};

export type GuideJourney = {
  id: string;
  title: string;
  summary: string;
  duration: string;
  icon: GuideIconName;
  accent: GuideAccent;
  guestOk: boolean;
  steps: GuideStep[];
};

/** Shown in the mock browser chrome — matches the live canonical host. */
export const GUIDE_LIVE_HOST = "www.sparkanddriveautos.com";

export const PLATFORM_GUIDE_JOURNEYS: GuideJourney[] = [
  {
    id: "browse-cars",
    title: "Browse and reserve a car",
    summary: "Filter Ghana or China stock, open a listing, then reserve with a deposit or pay in full.",
    duration: "4 steps",
    icon: "car",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "cars-home",
        title: "Start from the storefront",
        tap: "Tap Browse cars on the home page — the teal button in the first row of actions.",
        detail:
          "The home hero has three primary actions: Browse cars, Browse Electric Bikes & Motorcycles, and Buy Parts & Accessories. You can also open Inventory later from the footer on the home page. Guests can browse every published listing without an account.",
        mock: "home",
        highlight: "browse-cars",
        route: "/inventory",
        routeLabel: "Open inventory",
      },
      {
        id: "cars-filter",
        title: "Filter what you can buy online",
        tap: "Set Stock status to Available only, choose Ghana or China, then tap Apply.",
        detail:
          "Find Your Next Car lists published Ghana and China stock only — in-transit units are excluded. Available only is stock you can pay for online. Sold only is browse-only for reference. Search by brand, model, or keywords.",
        mock: "inventory",
        highlight: "apply-filters",
        route: "/inventory?availability=available",
        routeLabel: "Open available cars",
      },
      {
        id: "cars-listing",
        title: "Open a listing and review the car",
        tap: "Tap a vehicle card, then read source, price, specs, and the reserve row.",
        detail:
          "Each listing shows Ghana or China source, availability, converted price, engine, transmission, mileage, and delivery window. China-sourced cars also include an Import planning duty calculator. Compare and favourite controls sit beside checkout. Favourites need a signed-in account.",
        mock: "car-detail",
        highlight: "reserve-deposit",
        route: "/inventory",
        routeLabel: "Browse listings",
      },
      {
        id: "cars-checkout",
        title: "Reserve with deposit or pay full",
        tap: "Tap Reserve with deposit (or Pay full), then complete checkout.",
        detail:
          "Online checkout charges the reservation deposit as a percentage of the list total, in Ghana cedis. After a successful deposit, the remaining balance is due within 21 days and the team will contact you to arrange payment. Checkout asks you to sign in if you are a guest. Track the order from Dashboard → All Orders.",
        mock: "checkout",
        highlight: "pay-checkout",
        route: "/login?callbackUrl=%2Finventory",
        routeLabel: "Sign in to check out",
        needsAccount: true,
      },
    ],
  },
  {
    id: "shop-parts",
    title: "Shop parts & accessories",
    summary: "Use Spark and Drive Gear: Ghana Stock vs Overseas Stock, OEM search, cart, and wallet.",
    duration: "4 steps",
    icon: "parts",
    accent: "gear",
    guestOk: true,
    steps: [
      {
        id: "parts-open",
        title: "Open the parts shop",
        tap: "Tap Buy Parts & Accessories on home, or go straight to Parts & Accessories.",
        detail:
          "The parts shop uses the Spark and Drive Gear theme (red). Start with Parts, Tools, or Accessories, then a department such as Brakes, Engine, Filters, Lights, Suspension, Fluids, or Wheels. Guests can browse the catalog without signing in.",
        mock: "home",
        highlight: "buy-parts",
        route: "/parts",
        routeLabel: "Open parts shop",
      },
      {
        id: "parts-stock",
        title: "Choose Ghana or overseas stock",
        tap: "Tap Ghana Stock for local-ready parts, or Overseas Stock for items that ship in.",
        detail:
          "Ghana Stock is ready locally. Overseas Stock ships in. You can also keep All Stock, then search an OEM number or filter by vehicle make and model. Need something we do not list? Use Request AutoParts from the shop.",
        mock: "parts",
        highlight: "ghana-stock",
        route: "/parts?stock=ghana",
        routeLabel: "Open Ghana Stock",
      },
      {
        id: "parts-search",
        title: "Search, then add to cart",
        tap: "Type an OEM number or part name in Search, then open a part card to add it to the cart.",
        detail:
          "Exact OEM matches are lifted to the top of results. Open a part for photos, fitment, and origin. The cart icon stays in the shop header. Checkout for parts uses the storefront wallet once you have an account.",
        mock: "parts",
        highlight: "search-oem",
        route: "/parts",
        routeLabel: "Search parts",
      },
      {
        id: "parts-wallet",
        title: "Fund the wallet and pay",
        tap: "Open the wallet panel in the shop header (or Profile), add funds, then complete checkout.",
        detail:
          "The storefront wallet is for parts and accessories only. Signed-in customers add funds via Paystack (mobile money). Verified top-ups credit the wallet so you can finish the cart. Guests can browse; paying needs an account. Receipts appear under Dashboard → My receipts.",
        mock: "wallet",
        highlight: "wallet-topup",
        route: "/login?callbackUrl=%2Fparts",
        routeLabel: "Sign in for wallet",
        needsAccount: true,
      },
    ],
  },
  {
    id: "parts-finder",
    title: "Spark Parts Finder",
    summary: "Sign in, activate membership, then search by VIN, chassis, or OEM for ranked matches.",
    duration: "4 steps",
    icon: "finder",
    accent: "finder",
    guestOk: true,
    steps: [
      {
        id: "pf-entry",
        title: "Open Spark Parts Finder",
        tap: "Tap the orange Spark Parts Finder button on home, or open Parts Finder entry.",
        detail:
          "Spark Parts Finder is a membership search engine: evidence-based matches for an OEM number or a high-quality equivalent, using VIN, chassis, or vehicle details, with images and summaries. You can read the overview without paying; running searches requires an active membership.",
        mock: "home",
        highlight: "parts-finder",
        route: "/parts-finder",
        routeLabel: "Read the overview",
      },
      {
        id: "pf-signin",
        title: "Sign in before the engine opens",
        tap: "Tap Sign in to activate if you are a guest — entry sends you to login first.",
        detail:
          "The entry route checks your session. Guests go to login, then return to Parts Finder. After sign-in, expired or unpaid memberships go to Activate or renew. Active members land on search. Nothing in the catalog is hidden from guests; only the search engine is gated.",
        mock: "parts-finder",
        highlight: "sign-in",
        route: "/login?callbackUrl=%2Fparts-finder%2Fentry",
        routeLabel: "Sign in to enter",
        needsAccount: true,
      },
      {
        id: "pf-search",
        title: "Search with VIN, chassis, or OEM",
        tap: "On Find Parts, enter VIN or chassis plus the part you need, then run the search.",
        detail:
          "The engine interprets vehicle and part intent, gathers web evidence, and returns a short ranked list — never a raw dump of unvetted links. Confidence tiers describe match quality; they are not OEM certification and do not guarantee fit.",
        mock: "parts-finder",
        highlight: "vin-search",
        route: "/parts-finder/search",
        routeLabel: "Open Find Parts",
        needsAccount: true,
      },
      {
        id: "pf-next",
        title: "Act on a match",
        tap: "From results, shop the catalog, request sourcing, or continue in live support.",
        detail:
          "Use a match to search Parts & Accessories, open Request AutoParts or Accessories, or ask the team in Live Support Chat. Saved vehicles live in the garage view under Dashboard → Parts Finder. Membership is managed from Activate or renew.",
        mock: "parts-finder",
        highlight: "next-steps",
        route: "/parts",
        routeLabel: "Shop the catalog",
      },
    ],
  },
  {
    id: "request",
    title: "Request a car or parts",
    summary: "Source a vehicle (account required) or request autoparts with a paid enquiry fee.",
    duration: "4 steps",
    icon: "request",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "req-choose",
        title: "Pick the right request",
        tap: "Choose Request a car for vehicles, or Request AutoParts or Accessories for parts.",
        detail:
          "These are sourcing leads, not instant inventory. Vehicle requests cover Ghana stock, China sourcing, or either. Parts requests describe the part and the vehicle it fits. Both are listed under Explore on the home-page footer.",
        mock: "home",
        highlight: "request-paths",
        route: "/request-a-car",
        routeLabel: "Open request a car",
      },
      {
        id: "req-car",
        title: "Request a car — account required",
        tap: "Create Account or Sign in, then complete make, model, and sourcing notes.",
        detail:
          "Vehicle sourcing is signed-in only so the enquiry stays on your account and updates stay in one place. After you submit, track it under Dashboard → Customer Inquiry & Request. Sourcing is best-effort and not guaranteed until commercial terms are agreed.",
        mock: "request-car",
        highlight: "create-account",
        route: "/request-a-car",
        routeLabel: "Open request a car",
        needsAccount: true,
      },
      {
        id: "req-parts",
        title: "Request autoparts — pay the fee",
        tap: "Fill the part and vehicle details, then pay the request fee to start the search.",
        detail:
          "Guests can submit name, email, and phone. Signed-in customers skip those fields. A request fee in Ghana cedis is charged before work starts. Replies arrive in your messages. This is a sourcing enquiry, not a confirmed order.",
        mock: "request-parts",
        highlight: "pay-fee",
        route: "/request-autoparts",
        routeLabel: "Open parts request",
      },
      {
        id: "req-track",
        title: "Track replies from your dashboard",
        tap: "After you have an account, open Customer Inquiry & Request or Messages.",
        detail:
          "Car sourcing leads and parts replies stay on your account. Use Live Support Chat if you need to add photos, documents, or a voice note while a request is open.",
        mock: "dashboard",
        highlight: "inquiry",
        route: "/dashboard/inquiry-requests",
        routeLabel: "Open inquiries",
        needsAccount: true,
      },
    ],
  },
  {
    id: "motorcycles",
    title: "Motorcycles & e-bikes",
    summary: "Browse petrol and electric bikes, filter Ghana or China, then reserve like a car.",
    duration: "3 steps",
    icon: "bike",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "moto-open",
        title: "Open the motorcycle catalog",
        tap: "Tap Browse Electric Bikes & Motorcycles on home.",
        detail:
          "That home button opens /electric-bikes-motorcycles, which takes you to Motorcycles & E-Bikes. Sport bikes, scooters, electric motorcycles, and e-bicycles are listed together. Guests can browse without an account.",
        mock: "home",
        highlight: "browse-bikes",
        route: "/motorcycles",
        routeLabel: "Open motorcycles",
      },
      {
        id: "moto-filter",
        title: "Filter fuel type and location",
        tap: "Choose Ghana or China, Petrol / Diesel or Electric, then tap Filter.",
        detail:
          "The same Ghana and China source rules as cars apply. Featured units appear at the top when you have not searched. Listings that can be paid online show a deposit hint on the card.",
        mock: "motorcycles",
        highlight: "fuel-filter",
        route: "/motorcycles",
        routeLabel: "Browse bikes",
      },
      {
        id: "moto-reserve",
        title: "Open a listing and reserve",
        tap: "Open a motorcycle card, then tap Reserve with deposit or Pay full when offered.",
        detail:
          "Checkout follows the same deposit and 21-day remaining-balance window as cars. Shipping and duty estimates appear on listings where they are configured. Sign in at checkout if you are a guest.",
        mock: "car-detail",
        highlight: "reserve-deposit",
        route: "/motorcycles",
        routeLabel: "Open motorcycles",
        needsAccount: true,
      },
    ],
  },
  {
    id: "duty",
    title: "Duty and import estimates",
    summary: "Use the listing calculator for a planning figure, then review team estimates in your dashboard.",
    duration: "4 steps",
    icon: "duty",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "duty-where",
        title: "Where the calculator lives",
        tap: "Open a China-sourced car listing, then scroll to Import planning.",
        detail:
          "There is no standalone public duty calculator. On China and in-transit car pages, Import planning embeds Spark & Drive Duty Intelligence. The list price is pre-filled as a non-CIF placeholder — change it to the valuation you will declare.",
        mock: "duty",
        highlight: "duty-calc",
        route: "/inventory?source=IN_CHINA",
        routeLabel: "Browse China stock",
      },
      {
        id: "duty-disclaimer",
        title: "Treat figures as planning only",
        tap: "Read the disclaimer under the calculator before you rely on a number.",
        detail:
          "Results are indicative Ghana import duty ranges and landed-cost planning. Final duty and government charges are determined by Ghana Customs at clearance. Timelines for shipping and clearance are estimates and can change.",
        mock: "duty",
        highlight: "disclaimer",
        route: "/faq",
        routeLabel: "See FAQ on duty",
      },
      {
        id: "duty-dashboard",
        title: "Team-prepared estimates",
        tap: "After you have an account, open Dashboard → Duty Estimates.",
        detail:
          "When the team prepares a vehicle import estimate for you, it appears here with status (sent, accepted, expired). Clearance duty payment requests show on the matching order, not only on the estimate. Sign in is required.",
        mock: "dashboard",
        highlight: "duty-estimates",
        route: "/dashboard/estimates",
        routeLabel: "Open duty estimates",
        needsAccount: true,
      },
      {
        id: "duty-help",
        title: "Ask for clearance help",
        tap: "Use Live Support Chat, or Contact, if you need the team to assist with clearance.",
        detail:
          "Clearance support is available on request. It is not automatic on every order. Keep an eye on order updates and notifications when a vehicle is moving and duty payment is requested.",
        mock: "chat-gate",
        highlight: "start-chat",
        route: "/chat",
        routeLabel: "Open live support",
      },
    ],
  },
  {
    id: "account",
    title: "Account, Ghana Card, wallet, receipts",
    summary: "Create an account, verify Ghana Card, fund the parts wallet, and download receipts.",
    duration: "4 steps",
    icon: "account",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "acct-open",
        title: "Find sign-in from any page",
        tap: "Tap the menu on the right of the header, then Create Account or Login with email or phone.",
        detail:
          "The header is the same on every public page: logo on the left (Home and Dashboard), theme toggle in the centre, account and currency menu on the right. Guests can use Google or Apple when those options are configured. Dashboard itself requires a signed-in session.",
        mock: "header",
        highlight: "account-menu",
        route: "/register",
        routeLabel: "Create an account",
      },
      {
        id: "acct-ghana",
        title: "Add your Ghana Card",
        tap: "In Dashboard → Profile, open verification and save your Ghana Card number and expiry.",
        detail:
          "Ghana Card details are used at checkout and delivery. Save the number and expiry, then wait for review. You can also manage Ghana delivery addresses on Profile. Keep the card details accurate — checkout can require them.",
        mock: "ghana-card",
        highlight: "ghana-save",
        route: "/dashboard/profile?view=verification",
        routeLabel: "Open verification",
        needsAccount: true,
      },
      {
        id: "acct-wallet",
        title: "Fund the storefront wallet",
        tap: "On Profile, use Storefront wallet to add funds via Paystack (mobile money).",
        detail:
          "Wallet balance is for parts and accessories checkout, not vehicle deposits. Authorised payments credit the wallet so you can complete a cart. The same wallet panel also appears in the parts shop header when you are signed in.",
        mock: "wallet",
        highlight: "wallet-topup",
        route: "/dashboard/profile",
        routeLabel: "Open profile",
        needsAccount: true,
      },
      {
        id: "acct-receipts",
        title: "Orders, shipping, and receipts",
        tap: "Open All Orders, Shipping & Delivery Tracking, or My receipts from the dashboard.",
        detail:
          "All Orders and All Payments list vehicle and parts transactions after verification. Shipping & Delivery Tracking is for units already moving. My receipts lets you download issued payment receipts. Notifications sit in the header bell after you sign in.",
        mock: "receipts",
        highlight: "download-receipt",
        route: "/dashboard/receipts",
        routeLabel: "Open receipts",
        needsAccount: true,
      },
    ],
  },
  {
    id: "chat",
    title: "Live support chat",
    summary: "Sign in, then message the team with text, photos, files, or a voice note.",
    duration: "3 steps",
    icon: "chat",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "chat-open",
        title: "Open Customer Service Live Support",
        tap: "Go to Live Support Chat from the home footer, or open /chat.",
        detail:
          "Live support is signed-in only so the conversation is tied to your account and the team can help you securely. Guests see Create Account and Sign in first. You can still browse inventory, parts, and this FAQ without chatting.",
        mock: "chat-gate",
        highlight: "create-account",
        route: "/chat",
        routeLabel: "Open live support",
      },
      {
        id: "chat-send",
        title: "Send a message the team can act on",
        tap: "Type in the composer, or tap the round mic once to record and again to send.",
        detail:
          "You can send text, images, video, documents, and voice notes. Include the car slug, part OEM, or order reference when you have one. Messages update in real time when configured, with a quick refresh otherwise.",
        mock: "chat-thread",
        highlight: "composer",
        route: "/chat",
        routeLabel: "Open live support",
        needsAccount: true,
      },
      {
        id: "chat-continue",
        title: "Pick the thread up later",
        tap: "Return to /chat, or open Messages from your dashboard when you are signed in.",
        detail:
          "The same customer thread is what support staff reply in. Keep one conversation per issue when you can, and watch notifications for replies.",
        mock: "dashboard",
        highlight: "messages",
        route: "/dashboard/chats",
        routeLabel: "Open messages",
        needsAccount: true,
      },
    ],
  },
  {
    id: "policies",
    title: "Policies and legal",
    summary: "Read reservation, refund, sourcing, privacy, and payment rules before you pay.",
    duration: "3 steps",
    icon: "policies",
    accent: "brand",
    guestOk: true,
    steps: [
      {
        id: "pol-index",
        title: "Start at All policies",
        tap: "Open All policies, then pick the document you need.",
        detail:
          "The index lists Privacy, Terms and Conditions, Reservation Policy, Refund Policy, Sourcing Policy, and Payment and Dispute Policy. Canonical /legal routes sit on the same page. Guests can read every policy without an account.",
        mock: "policies",
        highlight: "all-policies",
        route: "/policies",
        routeLabel: "Open all policies",
      },
      {
        id: "pol-reserve",
        title: "Reservations, refunds, and sourcing",
        tap: "Open Reservation Policy before you pay a deposit; use Refunds and Sourcing as needed.",
        detail:
          "Reservations typically require a deposit and a limited hold. If full payment is not completed in time, the reservation may expire. Refunds depend on verification status and costs already incurred. Sourcing is best-effort until terms are agreed.",
        mock: "policies",
        highlight: "reservation-policy",
        route: "/reservation-policy",
        routeLabel: "Open reservation policy",
      },
      {
        id: "pol-accept",
        title: "Accept current documents in your account",
        tap: "After you sign in, review pending legal items on the dashboard and accept them once.",
        detail:
          "Checkout, Parts Finder, and sourcing each have notices you accept from your account. Profile → legal shows what you have already accepted. Stay on the current versions before you pay or submit a sourcing request.",
        mock: "dashboard",
        highlight: "legal",
        route: "/dashboard/profile?view=legal",
        routeLabel: "Open legal status",
        needsAccount: true,
      },
    ],
  },
];
