import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login.dart';

class HomePage extends StatelessWidget {
  final String userEmail;

  const HomePage({super.key, required this.userEmail});

  Future<void> _logout(BuildContext context) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('accessToken');
    if (context.mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginPage()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _logout(context),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.home, size: 80, color: Colors.deepPurple),
            const SizedBox(height: 16),
            const Text(
              'Welcome!',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
             const SizedBox(height: 8),
            Text(
              'Logged in as:',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
            Text(
              userEmail,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w500),
            ),
             const SizedBox(height: 32),
             ElevatedButton(
              onPressed: () {
                // Placeholder for game logic or other features
                 ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Game feature coming soon!')),
                  );
              },
               child: const Text('Start Game'),
             ),
          ],
        ),
      ),
    );
  }
}
