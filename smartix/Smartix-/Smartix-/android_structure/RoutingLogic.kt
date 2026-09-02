/*
Ajoutez ceci dans votre MainActivity.kt pour gérer le routage à l'ouverture :
*/

override fun onResume() {
    super.onResume()
    val screen = intent.getStringExtra("screen")
    val id = intent.getStringExtra("id")

    if (screen != null) {
        handleDeepLink(screen, id)
    }
}

private fun handleDeepLink(screen: String, id: String?) {
    when (screen) {
        "post" -> {
            // Ouvrir l'écran du post avec l'id
            // openPostFragment(id)
        }
        "message" -> {
            // Ouvrir la conversation
            // openChatFragment(id)
        }
        "profile" -> {
            // Ouvrir le profil
        }
    }
}
