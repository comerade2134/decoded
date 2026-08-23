export type DynamicStatus =
  | "Chasing"
  | "Leading"
  | "Balanced"
  | "Fading"
  | "Testing Frame";

export type EnergyLevel = "High" | "Balanced" | "Low" | "Fading";

export type RelationshipContext =
  | "Talking Stage"
  | "First Date"
  | "Post-Date"
  | "Situationship"
  | "Ex / Re-connect"
  | "Dry Spell / Ghosting";

export type Trajectory =
  | "Accelerating Interest"
  | "Stable / Plateau"
  | "Decelerating / Frame Loss";

export interface SafePlay {
  reply: string;
  reasoning: string;
  timing: string;
}

export interface BoldPlay {
  reply: string;
  reasoning: string;
  risk: string;
}

export interface WalkAwayOption {
  isRecommended: boolean;
  triggerReason: string;
  dignityRule: string;
  reEngagementCondition: string;
}

export interface UserVoiceProfile {
  styleToggles: {
    allLowercase: boolean;
    dryHumor: boolean;
    fastAndPunchy: boolean;
    zeroEmoji: boolean;
  };
  customSampleTexts: string;
}

export interface AnalysisResponse {
  subtext: string;
  status: DynamicStatus;
  energyLevel: EnergyLevel;
  trapToAvoid: string;
  internalMonologue: string;
  safePlay: SafePlay;
  boldPlay: BoldPlay;
  walkAwayOption?: WalkAwayOption;
  trajectory?: Trajectory;
}

export interface AnalysisRequest {
  messages: string;
  relationshipContext?: RelationshipContext | string;
  userVoiceProfile?: UserVoiceProfile;
  contactHistoryCount?: number;
}

export interface AnalysisRecord {
  id: string;
  timestamp: number;
  messages: string;
  relationshipContext: RelationshipContext;
  response: AnalysisResponse;
}

export interface ContactDossier {
  id: string;
  name: string;
  tag?: string; // e.g. "Hinge", "Bumble", "Met at event", "Ex"
  context: RelationshipContext;
  createdAt: number;
  history: AnalysisRecord[];
}

export interface SamplePreset {
  id: string;
  title: string;
  context: RelationshipContext;
  messages: string;
}
