/// OPDesk backend base URL.
///
/// For local development use:
///   flutter run -d R9ZY20B78VT --dart-define=API_BASE_URL=http://192.168.1.10:3000
///
/// Production builds use the deployed OPDesk API by default.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://bharat-infotechs-opdesk.vercel.app',
);
