export interface GitHubUser {
  login: string;
  avatar_url: string;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  languages_url: string;
  stargazers_count: number;
  language: string | null;
  created_at?: string;
}

export type LanguageWeights = Record<string, number>;
