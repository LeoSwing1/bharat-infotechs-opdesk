import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thrown for any non-2xx API response, carrying the server's error message
/// (OPDesk's API always responds with `{ "error": "..." }` on failure).
class ApiException implements Exception {
  final int? statusCode;
  final String message;
  ApiException(this.statusCode, this.message);

  @override
  String toString() => message;
}

/// Wraps the OPDesk REST API.
///
/// Auth model: the web app uses an HttpOnly session cookie, but a native
/// mobile app can't rely on that persisting the way a browser's cookie jar
/// does. Instead this client stores the same signed JWT the web app gets at
/// login in the platform secure storage (Keychain / Keystore) and sends it
/// as `Authorization: Bearer <token>` on every request — the backend's
/// `getSession()` accepts either the cookie or this header.
class ApiClient {
  ApiClient({required this.baseUrl}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: _tokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ));
  }

  /// Example: https://opdesk.bharatinfotechs.com or http://10.0.2.2:3000
  /// for the Android emulator talking to a locally-running `npm run dev`.
  final String baseUrl;
  late final Dio _dio;
  final _storage = const FlutterSecureStorage();
  static const _tokenKey = 'opdesk_session_token';

  Future<void> saveToken(String token) => _storage.write(key: _tokenKey, value: token);
  Future<void> clearToken() => _storage.delete(key: _tokenKey);
  Future<bool> hasToken() async => (await _storage.read(key: _tokenKey)) != null;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    try {
      final res = await _dio.post(path, data: body);
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    try {
      final res = await _dio.patch(path, data: body);
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  Future<Map<String, dynamic>> delete(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.delete(path, queryParameters: query);
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }

  ApiException _toApiException(DioException e) {
    final data = e.response?.data;
    final status = e.response?.statusCode;
    if (data is Map && data['error'] is String) {
      return ApiException(status, data['error'] as String);
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return ApiException(null, 'Could not reach the server. Check your connection and try again.');
    }
    return ApiException(status, 'Something went wrong. Please try again.');
  }
}
