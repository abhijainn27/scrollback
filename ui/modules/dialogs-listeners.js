/* jshint browser: true */
/* global $ */

module.exports = function(core, config, store) {
	var appUtils = require("../../lib/app-utils.js"),
		validateEntity = require("../utils/validate-entity.js")(core, config, store),
		createEntity = require("../utils/create-entity.js")(core, config, store),
		showDialog = require("../utils/show-dialog.js")(core, config, store),
		userChangeCallback;

	function createAndValidate(type, entry, button, callback) {
		var $entry = $(entry),
			$button = $(button),
			name = $entry.val();

		createEntity(type, name, function(res, message) {
			if (res === "wait") {
				$button.addClass("working");
			} else {
				$button.removeClass("working");
			}

			if (res === "error") {
				$entry.validInput(function(value, callback) {
					callback(message);
				});
			}

			if (res === "ok") {
				if (type === "room") {
					core.emit("setstate", {
						nav: {
							room: name,
							mode: "room",
							dialog: null,
							dialogState: null
						}
					});
				} else {
					core.emit("setstate", {
						nav: {
							dialog: null,
							dialogState: null
						}
					});
				}

				if (typeof callback === "function") {
					callback();
				}
			}
		});
	}

	core.on("statechange", function(changes, next) {
		var nav = store.getNav(),
			user = store.get("user");

		if (changes.nav && ("dialog" in changes.nav || (nav.dialog && changes.nav.dialogState === "update"))) {
			if (nav.dialog) {
				showDialog(nav.dialog);
			} else {
				$.modal("dismiss");
			}
		}

		if (typeof userChangeCallback === "function" && changes.user && appUtils.isGuest(store.get("user"))) {
				userChangeCallback();
				userChangeCallback = null;
		}

		if (changes.entities && changes.entities[user] && store.getUser().identities) {
			if (appUtils.isGuest(store.get("user"))) {
				// User signs up
				if (nav.dialog === "createroom" ) {
					// Trying to create room
					core.emit("setstate", {
						nav: { dialogState: "update" }
					});
				} else {
					core.emit("setstate", {
						nav: { dialog: "signup" }
					});
				}
			} else if (changes.user) {
				// User signs in
				if (nav.dialog === "createroom" ) {
					// Trying to create room
					core.emit("setstate", {
						nav: { dialogState: "update" }
					});
				} else if (/(signup|signin)/.test(nav.dialog)) {
					core.emit("setstate", {
						nav: {
							dialog: null,
							dialogState: null
						}
					});
				}
			}
		}

		next();
	}, 100);

	core.on("createroom-dialog", function(dialog, next) {
		var nav = store.getNav(),
			user = store.getUser(),
			roomName = (nav.dialogState === "prefill") ? nav.room : "";

		if (user && appUtils.isGuest(user.id)) {
			if (user.identities && user.identities.length) {
				dialog.title = "Create a new room";
				dialog.content = [
					"<p><b>Step 1:</b> Choose a username</p>",
					"<input type='text' id='createroom-dialog-user' autofocus>",
					"<p><b>Step 2:</b> Choose a room name</p>",
					"<input type='text' id='createroom-dialog-room' value='" + roomName + "' autofocus>"
				];
				dialog.action = {
					text: "Sign up & create room",
					action: function() {
						var $userEntry = $("#createroom-dialog-user"),
							$roomEntry = $("#createroom-dialog-room"),
							self = this;

						$userEntry.validInput(function(username, callback) {
							var roomname = $roomEntry.val();

							roomname = (typeof roomname === "string") ? roomname.toLowerCase().trim() : "";
							username = (typeof username === "string") ? username.toLowerCase().trim() : "";

							if (!username) {
								callback("User name cannot be empty");
							} else if (username === roomname) {
								callback("User and room names cannot be the same");
							} else {
								$roomEntry.validInput(function(roomname, callback) {
									validateEntity("Room", roomname, function(res, message) {
										if (res === "error") {
											callback(message);
										}

										if (res === "ok") {
											callback();

											createAndValidate("user", $userEntry, self, function() {
												createAndValidate("room", $roomEntry, self);
											});
										}
									});
								});
							}
						});
					}
				};
			} else {
				dialog.title = "Create a new room";
				dialog.description = "<b>Step 1:</b> Sign in to scrollback";
				dialog.content = [
					"<p><b>Step 2:</b> Choose a room name</p>",
					"<input type='text' id='createroom-dialog-room' value='" + roomName + "' disabled>"
				];

				core.emit("auth", dialog, function() {
					next();
				});

				return;
			}
		} else {
			dialog.title = "Create a new room";
			dialog.description = "Choose a room name";
			dialog.content = ["<input type='text' id='createroom-dialog-room' value='" + roomName + "' autofocus>"];
			dialog.action = {
				text: "Create room",
				action: function() {
					createAndValidate("room", "#createroom-dialog-room", this);
				}
			};
		}

		next();
	}, 100);

	core.on("signup-dialog", function(dialog, next) {
		var user = store.getUser();

		if (user && appUtils.isGuest(user.id)) {
			if (user.identities && user.identities.length) {
				dialog.title = "Finish sign up";
				dialog.description = "Choose a username";
				dialog.content = [
					"<input type='text' id='signup-dialog-user' autofocus>",
					"<p>Be creative. People in Scrollback will know you by this name.</p>"
				];
				dialog.action = {
					text: "Create account",
					action: function() {
						createAndValidate("user", "#signup-dialog-user", this);
					}
				};
			} else {
				dialog.title = "Sign up for scrollback";

				core.emit("auth", dialog, function() {
					next();
				});

				return;
			}
		} else {
			dialog.title = "You're already signed in!";
			dialog.description = "Sign out to sign up for a new account";
		}

		next();
	}, 100);

	core.on("signin-dialog", function(dialog, next) {
		// Ask users to upgrade their session to unrestricted
		dialog.title = "Login to continue.";
		dialog.dismiss = false;

		userChangeCallback = function() {
			var user = store.getUser();

			if (store.getNav().dialog === "signin" && user && user.isRestricted) {
				core.emit("setstate", {
					nav: { dialog: null }
				});
			}
		};

		core.emit("auth", dialog, function() {
			next();
		});
	}, 100);

	core.on("noroom-dialog", function(dialog, next) {
		dialog.title = "This room doesn't exist";
		dialog.dismiss = false;

		next();
	}, 1000);

	core.on("disallowed-dialog", function(dialog, next) {
		dialog.title = "Domain Mismatch";
		dialog.dismiss = false;

		next();
	}, 1000);

	core.on("createthread-dialog", function(dialog, next) {
		dialog.title = "Start a new discussion";
		dialog.content = [
			"<input type='text' id='createthread-dialog-thread' placeholder='Enter discussion title' autofocus>",
			"<textarea id='createthread-dialog-text' placeholder='Enter your message' style='resize:none'></textarea>"
		];
		dialog.action = {
			text: "Start discussion",
			action: function() {
				var $threadEntry = $("#createthread-dialog-thread"),
					$textEntry = $("#createthread-dialog-text");

				$threadEntry.validInput(function(threadTitle, callback) {
					threadTitle = (threadTitle || "").trim();

					if (!threadTitle) {
						callback("Thread title cannot be empty");
					} else {
						$textEntry.validInput(function(text, callback) {
							text = (text || "").trim();

							if (!text) {
								callback("Message cannot be empty");
							} else {
								core.emit("text-up", {
									to: store.getNav().room,
									from: store.get("user"),
									text: text,
									time: new Date().getTime(),
									manualThreaded: 1,
									threads: [{
										id: "new",
										title: threadTitle,
										score: 1.0
									}]
								});
							}
						});
					}
				});
			}
		};

		next();
	}, 100);

	// When modal is dismissed, reset the dialog property
	$(document).on("modalDismissed", function() {
		core.emit("setstate", {
			nav: { dialog: null }
		});
	});
};