export interface PodcastEpisode {
  id: string;
  title: string;
  showName: string;
  description: string;
  duration: string;
  audioUrl: string;
  linkUrl: string;
  artworkUrl: string | null;
}

export interface PodcastProviderResult {
  episodes: PodcastEpisode[];
  error?: string;
}