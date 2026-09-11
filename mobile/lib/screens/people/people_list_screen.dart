import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/opdesk_repository.dart';
import '../../models/person.dart';
import '../../widgets/states.dart';
import '../../widgets/status_badge.dart';
import '../../widgets/sign_out_action.dart';
import 'person_detail_screen.dart';

class PeopleListScreen extends StatefulWidget {
  const PeopleListScreen({super.key});

  @override
  State<PeopleListScreen> createState() => _PeopleListScreenState();
}

class _PeopleListScreenState extends State<PeopleListScreen> {
  List<Person>? _people;
  String? _error;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final people = await context.read<OpDeskRepository>().listPeople(search: _searchController.text);
      if (!mounted) return;
      setState(() => _people = people);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _openCreateDialog() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _CreatePersonSheet(),
    );
    if (created == true) _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final canCreate = user?.canManagePeopleByDefault ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('People'), actions: const [SignOutAction()]),
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: _openCreateDialog,
              icon: const Icon(Icons.add),
              label: const Text('Add person'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchController,
              onSubmitted: (_) => _load(),
              decoration: InputDecoration(
                hintText: 'Search by name, email or employee ID…',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                isDense: true,
              ),
            ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) return ErrorState(message: _error!, onRetry: _load);
    if (_people == null) return const Center(child: CircularProgressIndicator());
    if (_people!.isEmpty) {
      return const EmptyState(title: 'No people found', description: 'Try a different search, or add your first person.');
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        itemCount: _people!.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final person = _people![index];
          return ListTile(
            title: Text(person.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('${person.employeeCode ?? '—'} · ${person.teamName ?? 'No team'}'),
            trailing: StatusBadge(status: person.status),
            onTap: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => PersonDetailScreen(personId: person.id)),
              );
              _load();
            },
          );
        },
      ),
    );
  }
}

class _CreatePersonSheet extends StatefulWidget {
  const _CreatePersonSheet();

  @override
  State<_CreatePersonSheet> createState() => _CreatePersonSheetState();
}

class _CreatePersonSheetState extends State<_CreatePersonSheet> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _designation = TextEditingController();
  String _role = 'INTERN_EMPLOYEE';
  String _employmentType = 'EMPLOYEE';
  bool _submitting = false;

  static const _roles = [
    ('HR_MANAGER', 'HR Manager'),
    ('MANAGER', 'Manager'),
    ('TEAM_LEAD', 'Team Lead'),
    ('INTERN_EMPLOYEE', 'Employee / Intern'),
  ];
  static const _employmentTypes = ['EMPLOYEE', 'INTERN', 'CONTRACT', 'FREELANCER', 'TRAINEE'];

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _designation.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _submitting = true);
    try {
      final (person, tempPassword) = await context.read<OpDeskRepository>().createPerson(
            name: _name.text.trim(),
            email: _email.text.trim(),
            role: _role,
            employmentType: _employmentType,
            designation: _designation.text.trim(),
          );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Person created'),
          content: Text(
            '${person.name} was added.\n\nEmployee ID: ${person.employeeCode}'
            '${tempPassword != null ? '\nTemporary password: $tempPassword\n\nShare these securely — this won\'t be shown again.' : ''}',
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Done'))],
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Add person', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Full name', border: OutlineInputBorder()),
                validator: (v) => (v == null || v.trim().length < 2) ? 'Enter a name' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder()),
                validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _designation,
                decoration: const InputDecoration(labelText: 'Designation', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _role,
                decoration: const InputDecoration(labelText: 'Role', border: OutlineInputBorder()),
                items: _roles.map((r) => DropdownMenuItem(value: r.$1, child: Text(r.$2))).toList(),
                onChanged: (v) => setState(() => _role = v ?? _role),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _employmentType,
                decoration: const InputDecoration(labelText: 'Employment type', border: OutlineInputBorder()),
                items: _employmentTypes
                    .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                    .toList(),
                onChanged: (v) => setState(() => _employmentType = v ?? _employmentType),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF111827)),
                  child: _submitting
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Create person'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
