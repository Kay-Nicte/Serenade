export const ORIENTATIONS = ['lesbian', 'bisexual', 'pansexual', 'sapphic', 'queer', 'other'] as const;
export const LOOKING_FOR_OPTIONS = ['friendship', 'dating', 'relationship', 'explore', 'travel_buddy'] as const;

export type Orientation = (typeof ORIENTATIONS)[number];
export type LookingFor = (typeof LOOKING_FOR_OPTIONS)[number];

export const INTERESTS = [
  'travel', 'cooking', 'music', 'hiking', 'yoga', 'photography', 'art',
  'gaming', 'reading', 'fitness', 'dancing', 'movies', 'nature', 'wine',
  'coffee', 'cats', 'dogs',
] as const;

export const CHILDREN_OPTIONS = [
  'has_and_wants_more', 'has_and_doesnt_want_more',
  'doesnt_have_and_wants', 'doesnt_have_and_doesnt_want', 'not_sure',
] as const;

export const ZODIAC_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

export const PET_OPTIONS = ['dog', 'cat', 'bird', 'fish', 'reptile', 'none'] as const;

export const SMOKING_OPTIONS = ['never', 'sometimes', 'regularly'] as const;
export const DRINKING_OPTIONS = ['never', 'sometimes', 'regularly'] as const;

export const HOGWARTS_HOUSES = ['gryffindor', 'slytherin', 'hufflepuff', 'ravenclaw'] as const;

export const LANGUAGES = [
  'spanish', 'english', 'catalan', 'basque', 'galician',
  'french', 'german', 'portuguese', 'italian', 'arabic', 'chinese', 'other',
] as const;

export const PRONOUNS = ['she_her', 'he_him', 'they_them', 'she_they', 'other'] as const;

export const GENDER_IDENTITY = [
  'cis_woman', 'trans_woman', 'non_binary', 'genderfluid', 'prefer_not_say', 'other',
] as const;

export const RELATIONSHIP_TYPE = [
  'monogamy', 'polyamory', 'open_relationship', 'not_sure',
] as const;

export const EXERCISE_OPTIONS = ['daily', 'few_times_week', 'weekly', 'rarely', 'never'] as const;

export const EDUCATION_OPTIONS = [
  'high_school', 'vocational', 'bachelors', 'masters', 'phd', 'other',
] as const;

export const RELIGION_OPTIONS = [
  'christian', 'muslim', 'jewish', 'hindu', 'buddhist',
  'atheist', 'agnostic', 'spiritual', 'other', 'prefer_not_say',
] as const;

export const MUSIC_GENRES = [
  'pop', 'rock', 'indie', 'electronic', 'hip_hop', 'reggaeton',
  'jazz', 'classical', 'rnb', 'folk', 'latin', 'metal', 'blues', 'kpop', 'other',
] as const;

export const Config = {
  maxPhotos: 6,
  maxBioLength: 500,
  maxNameLength: 50,
  minAge: 18,
  maxAge: 99,
  maxDailyProfiles: 10,
  photoMaxSizeMB: 5,
  photoAllowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  storageBucket: 'profile-photos',
  discoveryDefaults: {
    minAge: 18,
    maxAge: 99,
    maxDistance: 50,
  },
  maxDistanceLimit: 200,
  defaultMaxDistanceKm: 50,
  freeDailyLikes: 5,
  premiumDailyLikes: 10,
} as const;
