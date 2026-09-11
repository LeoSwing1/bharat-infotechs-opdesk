import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/opdesk_repository.dart';
import '../../widgets/states.dart';
import '../../widgets/sign_out_action.dart';

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  List<Map<String, dynamic>> _permissions = [];
  List<String> _roles = [];
  Map<String, Map<String, bool>> _grants = {};
  bool _readOnly = false;
  String? _error;
  bool _loading = true;

  static const _roleLabels = {
    'HR_MANAGER': 'HR Manager',
    'MANAGER': 'Manager',
    'TEAM_LEAD': 'Team Lead',
    'INTERN_EMPLOYEE': 'Employee / Intern',
  };

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await context.read<OpDeskRepository>().permissionMatrix();
      final permissions = ((res['permissions'] as List?) ?? [])
          .map((e) => e as Map<String, dynamic>)
          .toList();
      final roles = ((res['roles'] as List?) ?? []).map((e) => e as String).toList();
      final rawGrants = (res['grants'] as Map<String, dynamic>?) ?? {};
      final grants = rawGrants.map((role, value) => MapEntry(
            role,
            (value as Map<String, dynamic>).map((k, v) => MapEntry(k, v as bool)),
          ));
      if (!mounted) return;
      setState(() {
        _permissions = permissions;
        _roles = roles;
        _grants = grants;
        _readOnly = res['source'] == 'defaults';
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() { _error = e.message; _loading = false; });
    }
  }

  Future<void> _toggle(String role, String permissionKey, bool current) async {
    setState(() => _grants[role]![permissionKey] = !current);
    try {
      await context.read<OpDeskRepository>().setRolePermission(
            role: role,
            permissionKey: permissionKey,
            granted: !current,
          );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _grants[role]![permissionKey] = current);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final canEdit = (user?.isSuperAdmin ?? false) && !_readOnly;

    return Scaffold(
      appBar: AppBar(title: const Text('Roles & Permissions'), actions: const [SignOutAction()]),
      body: _error != null
          ? ErrorState(message: _error!, onRetry: _load)
          : _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_readOnly)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.amber.shade50, borderRadius: BorderRadius.circular(10)),
                        child: const Text(
                          'Showing built-in defaults. Connect a database to customize and save changes.',
                          style: TextStyle(fontSize: 13),
                        ),
                      )
                    else if (!canEdit)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(10)),
                        child: const Text(
                          'Only Super Admin can change role permissions. Viewing in read-only mode.',
                          style: TextStyle(fontSize: 13),
                        ),
                      ),
                    ..._groupedByCategory().entries.map((entry) => _CategorySection(
                          category: entry.key,
                          permissions: entry.value,
                          roles: _roles,
                          roleLabels: _roleLabels,
                          grants: _grants,
                          canEdit: canEdit,
                          onToggle: _toggle,
                        )),
                  ],
                ),
    );
  }

  Map<String, List<Map<String, dynamic>>> _groupedByCategory() {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final p in _permissions) {
      final category = p['category'] as String;
      map.putIfAbsent(category, () => []).add(p);
    }
    return map;
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({
    required this.category,
    required this.permissions,
    required this.roles,
    required this.roleLabels,
    required this.grants,
    required this.canEdit,
    required this.onToggle,
  });

  final String category;
  final List<Map<String, dynamic>> permissions;
  final List<String> roles;
  final Map<String, String> roleLabels;
  final Map<String, Map<String, bool>> grants;
  final bool canEdit;
  final Future<void> Function(String role, String permissionKey, bool current) onToggle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            category.toUpperCase(),
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade500, letterSpacing: 0.5),
          ),
          const SizedBox(height: 8),
          ...permissions.map((p) => _PermissionRow(
                permission: p,
                roles: roles,
                roleLabels: roleLabels,
                grants: grants,
                canEdit: canEdit,
                onToggle: onToggle,
              )),
        ],
      ),
    );
  }
}

class _PermissionRow extends StatelessWidget {
  const _PermissionRow({
    required this.permission,
    required this.roles,
    required this.roleLabels,
    required this.grants,
    required this.canEdit,
    required this.onToggle,
  });

  final Map<String, dynamic> permission;
  final List<String> roles;
  final Map<String, String> roleLabels;
  final Map<String, Map<String, bool>> grants;
  final bool canEdit;
  final Future<void> Function(String role, String permissionKey, bool current) onToggle;

  @override
  Widget build(BuildContext context) {
    final key = permission['key'] as String;
    final label = permission['label'] as String;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w500)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 6,
            children: roles.map((role) {
              final checked = grants[role]?[key] ?? false;
              return GestureDetector(
                onTap: canEdit ? () => onToggle(role, key, checked) : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Switch(
                      value: checked,
                      onChanged: canEdit ? (_) => onToggle(role, key, checked) : null,
                      activeTrackColor: const Color(0xFF111827),
                    ),
                    Text(roleLabels[role] ?? role, style: const TextStyle(fontSize: 12)),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}
