import { StreamLink } from '../types';

export interface StreamSource {
  name: string;
  getStreams(sport: string, team1: string, team2: string): Promise<StreamLink[]>;
}
