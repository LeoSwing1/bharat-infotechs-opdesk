import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home_shell.dart';

class OpDeskApp extends StatefulWidget {
  const OpDeskApp({super.key});

  @override
  State<OpDeskApp> createState() => _OpDeskAppState();
}

class _OpDeskAppState extends State<OpDeskApp> {
  @override
  void initState() {
    super.initState();
    // Fire-and-forget: check for a previously stored token on cold start.
    context.read<AuthProvider>().restoreSession();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OPDesk',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF111827),
        scaffoldBackgroundColor: const Color(0xFFF5F7FB),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF111827),
          elevation: 0,
          scrolledUnderElevation: 1,
        ),
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: Colors.white,
        ),
      ),
      home: const _AuthGate(),
    );
  }
}

/// Shows a splash while the stored session is being validated, then routes
/// to either the login screen or the authenticated app shell.
class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    switch (auth.status) {
      case AuthStatus.unknown:
        return const Scaffold(body: Center(child: CircularProgressIndicator()));
      case AuthStatus.unauthenticated:
        return const LoginScreen();
      case AuthStatus.authenticated:
        return const HomeShell();
    }
  }
}
