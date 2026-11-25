export const collections = [
  { id: "animals", title: "الحيوانات", cover: "alpaca", tint: "#fff0d9" },
  { id: "fantasy", title: "عالم الخيال", cover: "princess", tint: "#f2e7fc" },
  { id: "sea", title: "البحر", cover: "fishing_fish", tint: "#def5f8" },
  { id: "garden", title: "الحديقة", cover: "ladybug_on_leaf", tint: "#e7f4dc" },
] as const;

export interface Sheet {
  id: string;
  title: string;
  group: (typeof collections)[number]["id"];
}

export const sheets: Sheet[] = [
  { id: "alpaca", title: "الألبكة الصغيرة", group: "animals" },
  { id: "princess", title: "الأميرة وعصا النجوم", group: "fantasy" },
  { id: "summer_beach", title: "يوم على الشاطئ", group: "sea" },
  { id: "ladybug_on_leaf", title: "دعسوقة على ورقة", group: "garden" },
  { id: "cartoon_frog", title: "الضفدع المرح", group: "animals" },
  { id: "kawaii_unicorn_cloud", title: "غيمة وحيدة القرن", group: "fantasy" },
  { id: "fishing_fish", title: "السمكة الصيادة", group: "sea" },
  { id: "grape", title: "عنقود العنب", group: "garden" },
  { id: "donkey", title: "الحمار الصغير", group: "animals" },
  { id: "dragon", title: "التنين الطائر", group: "fantasy" },
  { id: "boy_surfer", title: "راكب الأمواج", group: "sea" },
  { id: "bitten_apple", title: "التفاحة المقضومة", group: "garden" },
  { id: "owl", title: "بومة الليل", group: "animals" },
  { id: "locked_heart", title: "قلب الأسرار", group: "fantasy" },
  { id: "shark_jaws", title: "سمكة القرش", group: "sea" },
  { id: "poppies_coloring_page", title: "زهور الحديقة", group: "garden" },
];
