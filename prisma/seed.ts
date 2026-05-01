import {
  AvailabilityStatus,
  CarListingState,
  DeliveryMode,
  EngineType,
  PartOrigin,
  PartListingState,
  PartStockStatus,
  Prisma,
  PrismaClient,
  ReceiptTemplateScope,
  SourceType,
  UserRole,
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1617814076367-b759c7d7be38?w=1200&q=80",
  "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1200&q=80",
  "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&q=80",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&q=80",
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1200&q=80",
];

const DEMO_VIDEOS = [
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
];

async function main() {
  const adminPass = await hash("DemoAdmin2026!", 12);
  const userPass = await hash("DemoUser2026!", 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { email: "admin@sparkdriveautos.com" },
      update: {},
      create: {
        email: "admin@sparkdriveautos.com",
        name: "Spark Admin",
        passwordHash: adminPass,
        role: UserRole.SUPER_ADMIN,
        country: "Ghana",
      },
    });

    const customer = await tx.user.upsert({
      where: { email: "customer@sparkdriveautos.com" },
      update: {},
      create: {
        email: "customer@sparkdriveautos.com",
        name: "Ama Mensah",
        passwordHash: userPass,
        role: UserRole.CUSTOMER,
        country: "Ghana",
        phone: "+233 20 000 0000",
      },
    });

    await tx.user.upsert({
      where: { email: "assistant@sparkdriveautos.com" },
      update: {},
      create: {
        email: "assistant@sparkdriveautos.com",
        name: "Demo Service Assistant",
        passwordHash: userPass,
        role: UserRole.SERVICE_ASSISTANT,
        country: "Ghana",
      },
    });

    await tx.globalCurrencySettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        usdToRmb: 7,
        rmbToGhs: 0.586,
        usdToGhs: 11.65,
      },
      update: {
        usdToRmb: 7,
        rmbToGhs: 0.586,
        usdToGhs: 11.65,
      },
    });

    for (const mode of [DeliveryMode.AIR_EXPRESS, DeliveryMode.AIR_STANDARD, DeliveryMode.SEA] as const) {
      await tx.deliveryOptionTemplate.upsert({
        where: { mode },
        create:
          mode === DeliveryMode.AIR_EXPRESS
            ? { mode, name: "Air Delivery Express", etaLabel: "3 days", feeGhs: 240, feeRmb: 85, sortOrder: 0 }
            : mode === DeliveryMode.AIR_STANDARD
              ? { mode, name: "Normal Air Delivery", etaLabel: "5-10 days", feeGhs: 160, feeRmb: 55, sortOrder: 1 }
              : { mode, name: "Sea Shipping", etaLabel: "35-45 days", feeGhs: 90, feeRmb: 32, sortOrder: 2 },
        update: {},
      });
    }
    await tx.paymentProviderConfig.upsert({
      where: { provider_label: { provider: "PAYSTACK", label: "Primary Paystack" } },
      create: { provider: "PAYSTACK", label: "Primary Paystack", enabled: true, isDefault: true },
      update: { enabled: true, isDefault: true },
    });
    for (const scope of [ReceiptTemplateScope.CAR, ReceiptTemplateScope.PARTS] as const) {
      await tx.receiptTemplateConfig.upsert({
        where: { scope },
        create: {
          scope,
          companyName: "Spark and Drive Autos",
          heading: scope === "CAR" ? "Official Vehicle Deposit Receipt" : "Official Parts Purchase Receipt",
          subheading: scope === "CAR" ? "Vehicle inventory payment" : "Parts and accessories payment",
          contactPhone: "+233 55 262 6997 / +233 26 145 5061",
          contactEmail: "sparkanddriveautos@gmail.com",
          officeAddress: "Accra, Ghana",
          disclaimer:
            "The stated amounts relate to the listed purchase only. Shipping, logistics, clearing, duty, registration, and related charges are separate unless agreed in writing.",
          thankYouNote: "Thank you for choosing Spark and Drive Autos.",
          signatureLabel: "Authorized Signature",
          accentColor: "#31b6c7",
          showSignature: true,
        },
        update: {},
      });
    }

    await tx.quickReplyTemplate.deleteMany();
    await tx.quickReplyTemplate.createMany({
      data: [
        {
          title: "Greeting",
          body: "Hello from Spark and Drive Autos. Thanks for reaching out — how can we help today?",
        },
        {
          title: "Shipping",
          body: "We can share a freight estimate to Tema once we confirm the vehicle and incoterms.",
        },
        {
          title: "Duty",
          body: "Duty depends on HS classification and CIF value; we can provide a transparent estimate after inspection.",
        },
      ],
    });

    const cars = [
      {
        slug: "mercedes-amg-gt-2023-accra",
        title: "Mercedes-AMG GT 2023 — Accra Ready",
        brand: "Mercedes-Benz",
        model: "AMG GT",
        year: 2023,
        trim: "Coupe",
        engineType: EngineType.GASOLINE_PETROL,
        transmission: "7-speed DCT",
        drivetrain: "RWD",
        mileage: 12000,
        colorExterior: "Obsidian Black",
        colorInterior: "Nappa Red/Black",
        sourceType: SourceType.IN_GHANA,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        price: 1850000,
        basePriceRmb: Math.round(1850000 / 1.8),
        currency: "GHS",
        location: "Accra, Ghana",
        featured: true,
        shortDescription: "Immaculate AMG GT in Ghana stock — inspection cleared, ready for handover.",
        longDescription:
          "Premium coupe with full service history. Ideal for buyers who want a turnkey vehicle already in-country with transparent logistics already complete.",
      },
      {
        slug: "tesla-model-y-2024-transit",
        title: "Tesla Model Y Long Range — In Transit",
        brand: "Tesla",
        model: "Model Y",
        year: 2024,
        trim: "Long Range AWD",
        engineType: EngineType.ELECTRIC,
        transmission: "Single-speed",
        drivetrain: "AWD",
        mileage: 8000,
        colorExterior: "Pearl White",
        colorInterior: "Black",
        sourceType: SourceType.IN_TRANSIT,
        availabilityStatus: AvailabilityStatus.IN_TRANSIT_STOCK,
        price: 920000,
        basePriceRmb: Math.round(920000 / 1.8),
        currency: "GHS",
        location: "En route to Tema",
        featured: true,
        shortDescription: "Electric SUV with strong range — currently in transit with milestone tracking.",
        longDescription:
          "Managed import journey with inspection-first workflow. Timeline updates appear in your dashboard after reservation.",
      },
      {
        slug: "toyota-landcruiser-2022-china",
        title: "Toyota Land Cruiser 300 — China Source",
        brand: "Toyota",
        model: "Land Cruiser",
        year: 2022,
        trim: "ZX",
        engineType: EngineType.GASOLINE_PETROL,
        transmission: "10-speed AT",
        drivetrain: "4WD",
        mileage: 45000,
        colorExterior: "Graphite",
        colorInterior: "Beige",
        sourceType: SourceType.IN_CHINA,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        price: 1450000,
        basePriceRmb: Math.round(1450000 / 1.8),
        currency: "GHS",
        location: "Tianjin / sourcing lane",
        featured: false,
        shortDescription: "Sourced unit from verified inventory — quotation includes landed cost breakdown.",
        longDescription:
          "We coordinate supplier confirmation, inspection, and shipping to Ghana with duty transparency at each stage.",
      },
    ];

    const RMB_TO_GHS = 0.586;
    for (const c of cars) {
      const basePriceAmount = new Prisma.Decimal(Number(c.basePriceRmb) / RMB_TO_GHS);
      const car = await tx.car.upsert({
        where: { slug: c.slug },
        update: {
          title: c.title,
          listingState: CarListingState.PUBLISHED,
          basePriceAmount,
          basePriceCurrency: "GHS",
          basePriceRmb: c.basePriceRmb,
          price: c.price,
          inspectionStatus: "Verified (demo)",
          estimatedDelivery: "7–21 days (estimate)",
          specifications: {
            horsepower: "Varies by trim",
            torque: "Factory spec",
            safety: "Full ADAS where equipped",
          },
        },
        create: {
          slug: c.slug,
          title: c.title,
          brand: c.brand,
          model: c.model,
          year: c.year,
          trim: c.trim,
          engineType: c.engineType,
          transmission: c.transmission,
          drivetrain: c.drivetrain,
          mileage: c.mileage,
          colorExterior: c.colorExterior,
          colorInterior: c.colorInterior,
          sourceType: c.sourceType,
          availabilityStatus: c.availabilityStatus,
          basePriceAmount,
          basePriceCurrency: "GHS",
          basePriceRmb: c.basePriceRmb,
          price: c.price,
          currency: c.currency,
          location: c.location,
          featured: c.featured,
          listingState: CarListingState.PUBLISHED,
          shortDescription: c.shortDescription,
          longDescription: c.longDescription,
          inspectionStatus: "Verified (demo)",
          estimatedDelivery: "7–21 days (estimate)",
          coverImageUrl: DEMO_IMAGES[0],
          specifications: {
            horsepower: "Varies by trim",
            torque: "Factory spec",
            safety: "Full ADAS where equipped",
          },
        },
      });

      const existing = await tx.carImage.count({ where: { carId: car.id } });
      if (existing === 0) {
        await tx.carImage.createMany({
          data: DEMO_IMAGES.map((url, i) => ({
            carId: car.id,
            url,
            sortOrder: i,
            altText: `${car.title} — image ${i + 1}`,
            isCover: i === 0,
          })),
        });
      }

      const vcount = await tx.carVideo.count({ where: { carId: car.id } });
      if (vcount === 0) {
        await tx.carVideo.createMany({
          data: DEMO_VIDEOS.map((url, i) => ({
            carId: car.id,
            url,
            sortOrder: i,
            isFeatured: i === 0,
            thumbnailUrl: DEMO_IMAGES[1],
          })),
        });
      }

      const specCount = await tx.carSpecification.count({ where: { carId: car.id } });
      if (specCount === 0) {
        await tx.carSpecification.createMany({
          data: [
            { carId: car.id, label: "Warranty", value: "As per supplier / dealer policy", sortOrder: 0 },
            { carId: car.id, label: "Service history", value: "Available on request", sortOrder: 1 },
          ],
        });
      }
    }

    const serviceCategory = await tx.partCategory.upsert({
      where: { slug: "service" },
      create: { name: "Service", slug: "service", sortOrder: 0 },
      update: {},
    });
    const interiorCategory = await tx.partCategory.upsert({
      where: { slug: "interior" },
      create: { name: "Interior", slug: "interior", sortOrder: 1 },
      update: {},
    });

    const partCount = await tx.part.count();
    if (partCount === 0) {
      await tx.part.createMany({
        data: [
          {
            slug: "demo-oil-filter-kit",
            title: "OEM oil filter kit",
            shortDescription: "Replacement filter set for routine service — verify fitment with your VIN.",
            description:
              "Includes primary filter and drain washer where applicable. Ask concierge for vehicle-specific confirmation before purchase.",
            basePriceRmb: new Prisma.Decimal("95.00"),
            sellingPriceCurrency: "GHS",
            supplierCostCurrency: "GHS",
            priceGhs: new Prisma.Decimal("120.00"),
            category: "Service",
            categoryId: serviceCategory.id,
            origin: PartOrigin.GHANA,
            stockQty: 24,
            stockStatus: PartStockStatus.IN_STOCK,
            listingState: PartListingState.PUBLISHED,
            tags: ["OEM", "service", "filters"],
            coverImageUrl: DEMO_IMAGES[2],
            featured: true,
          },
          {
            slug: "demo-all-weather-floor-mats",
            title: "All-weather floor mats (set of 4)",
            shortDescription: "Durable mats to protect interior carpets year-round.",
            description: "Trim-to-fit design. Contact us with your vehicle make and model for best results.",
            basePriceRmb: new Prisma.Decimal("260.00"),
            sellingPriceCurrency: "CNY",
            supplierCostCurrency: "CNY",
            priceGhs: new Prisma.Decimal("450.00"),
            category: "Interior",
            categoryId: interiorCategory.id,
            origin: PartOrigin.CHINA,
            stockQty: 8,
            stockStatus: PartStockStatus.LOW_STOCK,
            listingState: PartListingState.PUBLISHED,
            tags: ["interior", "protection"],
            coverImageUrl: DEMO_IMAGES[4],
            featured: false,
          },
        ],
      });
    }

    const chinaParts = await tx.part.findMany({ where: { origin: PartOrigin.CHINA } });
    const templates = await tx.deliveryOptionTemplate.findMany();
    for (const p of chinaParts) {
      for (const t of templates) {
        await tx.partDeliveryOption.upsert({
          where: { partId_templateId: { partId: p.id, templateId: t.id } },
          create: { partId: p.id, templateId: t.id },
          update: {},
        });
      }
    }

    const sampleCar = await tx.car.findFirst({ where: { slug: cars[0].slug } });
    if (sampleCar) {
      const ref = `ORD-SEED-${sampleCar.id.slice(0, 6).toUpperCase()}`;
      await tx.order.upsert({
        where: { reference: ref },
        update: {},
        create: {
          reference: ref,
          userId: customer.id,
          carId: sampleCar.id,
          orderStatus: "PROCESSING",
          paymentType: "RESERVATION_DEPOSIT",
          amount: 50000,
          currency: "GHS",
          notes: "Demo order for dashboard",
        },
      });
    }
  });

  console.log("Seed complete. Demo admin:", "admin@sparkdriveautos.com / DemoAdmin2026!");
  console.log("Demo customer:", "customer@sparkdriveautos.com / DemoUser2026!");
  console.log("Demo service assistant:", "assistant@sparkdriveautos.com / DemoUser2026! (inbox + inquiries only)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
