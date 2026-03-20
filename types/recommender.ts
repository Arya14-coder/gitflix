import { GitHubRepository, GitHubUser, LanguageWeights } from "./github";

export interface RepoRecommendation extends GitHubRepository {
  similarityScore?: number;
}

export interface RecommendationRow {
  title: string;
  repos: RepoRecommendation[];
}

export interface UserSkillProfile {
  topLanguages: string[];
  maxStars: number; // Used to filter out "too simple" repos
}

export interface RecommendationContext {
  user: GitHubUser;
  stars: GitHubRepository[];
  owned: GitHubRepository[];
  topLanguages: LanguageWeights;
}
