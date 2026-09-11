import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/api_client.dart';
import 'core/auth_provider.dart';
import 'core/config.dart';
import 'core/opdesk_repository.dart';

void main() {
  final apiClient = ApiClient(baseUrl: apiBaseUrl);
  final repository = OpDeskRepository(apiClient);

  runApp(
    MultiProvider(
      providers: [
        Provider<OpDeskRepository>.value(value: repository),
        ChangeNotifierProvider<AuthProvider>(create: (_) => AuthProvider(repository)),
      ],
      child: const OpDeskApp(),
    ),
  );
}
