// قائمة أبطال مقترحة للعرض في صفحة الطلب — يمكن للعميل اختيار واحد أو كتابة بطل آخر
export interface HeroOption {
  name: string;        // الاسم المعروض للعميل (عربي)
  enName: string;      // الاسم الإنجليزي (يُحفظ مع الطلب لتمريره للذكاء الاصطناعي)
  emoji: string;
  category: "خارقون" | "حيوانات وكرتون" | "مغامرون" | "أصلي";
  keywords: string[];  // كلمات بحث إضافية (عربي + إنجليزي)
}

export const HERO_OPTIONS: HeroOption[] = [
  // أبطال خارقون
  { name: "سوبرمان", enName: "Superman", emoji: "🦸‍♂️", category: "خارقون", keywords: ["superman", "سوبر مان", "الرجل الخارق"] },
  { name: "باتمان", enName: "Batman", emoji: "🦇", category: "خارقون", keywords: ["batman", "الرجل الوطواط", "بات مان"] },
  { name: "سبايدر مان", enName: "Spider-Man", emoji: "🕷️", category: "خارقون", keywords: ["spiderman", "spider-man", "الرجل العنكبوت"] },
  { name: "آيرون مان", enName: "Iron Man", emoji: "🤖", category: "خارقون", keywords: ["ironman", "iron man", "الرجل الحديدي"] },
  { name: "كابتن أمريكا", enName: "Captain America", emoji: "🛡️", category: "خارقون", keywords: ["captain america", "كابتن"] },
  { name: "هَلْك", enName: "Hulk", emoji: "💚", category: "خارقون", keywords: ["hulk", "العملاق الأخضر"] },
  { name: "ثور", enName: "Thor", emoji: "⚡", category: "خارقون", keywords: ["thor", "إله الرعد"] },
  { name: "فلاش", enName: "The Flash", emoji: "⚡", category: "خارقون", keywords: ["flash", "البرق"] },
  { name: "أكوامان", enName: "Aquaman", emoji: "🔱", category: "خارقون", keywords: ["aquaman", "ملك البحار"] },
  { name: "وندر وومان", enName: "Wonder Woman", emoji: "👸", category: "خارقون", keywords: ["wonder woman", "المرأة الخارقة"] },
  { name: "بلاك بانثر", enName: "Black Panther", emoji: "🐆", category: "خارقون", keywords: ["black panther", "النمر الأسود"] },

  // حيوانات وكرتون
  { name: "سونيك", enName: "Sonic", emoji: "💨", category: "حيوانات وكرتون", keywords: ["sonic", "القنفذ"] },
  { name: "بيكاتشو", enName: "Pikachu", emoji: "⚡", category: "حيوانات وكرتون", keywords: ["pikachu", "بوكيمون", "pokemon"] },
  { name: "ميكي ماوس", enName: "Mickey Mouse", emoji: "🐭", category: "حيوانات وكرتون", keywords: ["mickey", "mouse"] },
  { name: "سيمبا (الأسد الملك)", enName: "Simba the Lion King", emoji: "🦁", category: "حيوانات وكرتون", keywords: ["simba", "lion king", "ليون كنج"] },
  { name: "بو (الباندا الكونغ فو)", enName: "Po the Kung Fu Panda", emoji: "🐼", category: "حيوانات وكرتون", keywords: ["po", "kung fu panda", "كونغ فو باندا"] },

  // مغامرون
  { name: "هاري بوتر", enName: "Harry Potter", emoji: "🪄", category: "مغامرون", keywords: ["harry potter", "ساحر"] },
  { name: "بيتر بان", enName: "Peter Pan", emoji: "🧚", category: "مغامرون", keywords: ["peter pan"] },
  { name: "علاء الدين", enName: "Aladdin", emoji: "🧞", category: "مغامرون", keywords: ["aladdin", "المصباح السحري"] },
  { name: "روبن هود", enName: "Robin Hood", emoji: "🏹", category: "مغامرون", keywords: ["robin hood"] },
  { name: "نينجا", enName: "Ninja Warrior", emoji: "🥷", category: "مغامرون", keywords: ["ninja", "محارب"] },
  { name: "قبطان قرصان", enName: "Pirate Captain", emoji: "🏴‍☠️", category: "مغامرون", keywords: ["pirate", "قرصان"] },
  { name: "رائد فضاء", enName: "Astronaut Explorer", emoji: "🚀", category: "مغامرون", keywords: ["astronaut", "فضاء", "space"] },
  { name: "فارس شجاع", enName: "Brave Knight", emoji: "⚔️", category: "مغامرون", keywords: ["knight", "فارس"] },

  // أبطال أصليون (للأطفال الذين يفضلون شخصية فريدة)
  { name: "بطل خارق أصلي", enName: "Original Custom Superhero", emoji: "✨", category: "أصلي", keywords: ["original", "أصلي", "مخصص"] },
];

export const HERO_CATEGORIES: HeroOption["category"][] = [
  "خارقون",
  "حيوانات وكرتون",
  "مغامرون",
  "أصلي",
];
