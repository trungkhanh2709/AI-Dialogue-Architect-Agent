export type GoogleUser = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
};
export type AppTokenSet = {
  app_token: string;
  user_id?: string;
  iat?: number; // optional decode
  exp?: number;
};
export type Props = {
  onAuthChanged?: (signedIn: boolean, user: GoogleUser | null) => void;
  label?: string;
};
