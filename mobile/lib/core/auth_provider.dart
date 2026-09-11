import 'package:flutter/foundation.dart';
import 'api_client.dart';
import 'opdesk_repository.dart';
import '../models/session_user.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  AuthProvider(this.repository);

  final OpDeskRepository repository;

  AuthStatus status = AuthStatus.unknown;
  SessionUser? user;
  String? lastError;

  /// Called once at app start: if a token is already stored, validate it
  /// against /api/auth/me rather than trusting it blindly (it may have
  /// expired or the account may have been deactivated since).
  Future<void> restoreSession() async {
    try {
      final restored = await repository.currentUser();
      user = restored;
      status = restored != null ? AuthStatus.authenticated : AuthStatus.unauthenticated;
    } on ApiException {
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    lastError = null;
    try {
      user = await repository.login(email, password);
      status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      lastError = e.message;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await repository.logout();
    user = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}
