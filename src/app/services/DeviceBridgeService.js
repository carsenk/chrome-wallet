//require('angular');
//require('environmentConfig');
//require('chrome');
//require('main');

angular.module('kkWallet')
  .provider('DeviceBridgeService', function DeviceBridgeServiceProvider() {
    var incomingMessages = {};

    this.when = function (name, callback) {
      incomingMessages[name] = callback;
    };

    this.$get = ['$rootScope', '$q', 'chrome', 'environmentConfig', '$injector',
      function ($rootScope, $q, chrome, environmentConfig, $injector) {
        function sendMessage(message) {
          console.log('message sent to proxy:', message);
          return $q(function (resolve) {
            chrome.runtime.sendMessage(environmentConfig.keepkeyProxy.applicationId, message, {}, resolve);
          });
        }

        function respondToMessages(request, sender, sendResponse) {
          console.log("External message:", request);

          var messageArguments = {
            request: request,
            sender: sender,
            sendResponse: sendResponse
          };


          if (sender.id !== environmentConfig.keepkeyProxy.applicationId) {
            $injector.invoke(incomingMessages.unknownSender, messageArguments);
            return;
          }

          //TODO Since messages are broadcast, rethink whether a dispatcher is the
          // right thing to do.
          $rootScope.$broadcast(request.messageType, request.message);

          var messageHandler = incomingMessages[request.messageType];

          if (!messageHandler) {
            $injector.invoke(incomingMessages.unknownMessageType, messageArguments);
            return;
          }

          $injector.invoke(messageHandler, messageArguments);
        }

        return {
          startListener: function startListener() {
            chrome.runtime.onMessageExternal.addListener(respondToMessages);
          },
          stopListener: function stopListener() {
            chrome.runtime.onMessageExternal.removeListener(respondToMessages);
          },
          isDeviceReady: function () {
            return sendMessage({messageType: 'deviceReady'});
          },
          resetDevice: function (options) {
            var message = angular.extend({
              messageType: 'reset'
            }, options);
            return sendMessage(message);
          },
          wipeDevice: function () {
            return sendMessage({messageType: 'Wipe'});

          },
          sendPin: function (options) {
            var message = angular.extend({messageType: 'PinMatrixAck'}, options);
            return sendMessage(message);
          },
          initialize: function () {
            return sendMessage({messageType: 'Initialize'});
          },
          cancel: function () {
            return sendMessage({messageType: 'Cancel'});
          },
          recoverDevice: function (options) {
            var message = angular.extend({messageType: 'RecoveryDevice'}, options);
            return sendMessage(message);
          },
          acknowledgeWord: function (word) {
            var message = {messageType: 'WordAck', word: word};
            return sendMessage(message);
          },
          characterAck: function (character, deleteChar, done) {
            var message = {
              messageType: 'CharacterAck',
              character: character,
              delete: deleteChar,
              done: done
            };
            return sendMessage(message);
          },
          updateFirmware: function () {
            return sendMessage({
              messageType: 'FirmwareUpdate'
            });
          },
          getAddress: function (options) {
            var message = angular.extend({}, {
              messageType: 'GetAddress',
              addressN: [0],
              coinName: "Bitcoin",
              showDisplay: false
            }, options);
            return sendMessage(message);
          },
          getPublicKey: function (options) {
            var message = angular.extend({}, {
              messageType: 'GetPublicKey',
              addressN: [0]
            }, options);
            return sendMessage(message);
          },
          getWalletNodes: function () {
            return sendMessage({
              messageType: 'GetWalletNodes'
            });
          },
          getTransactions: function (reload) {
            return sendMessage({
              messageType: 'GetTransactions',
              reload: reload
            });
          },
          requestTransactionSignature: function (transactionRequest) {
            var message = angular.extend({}, {
              messageType: 'RequestTransactionSignature'
            }, transactionRequest);
            message.amount *= 100000000;
            return sendMessage(message);
          },
          getFees: function () {
            return sendMessage({
              messageType: 'GetFees'
            });
          },
          estimateFeeForTransaction: function (node, transactionAmount, feeLevel) {
            return sendMessage({
              messageType: 'EstimateFeeForTransaction',
              walletNode: node,
              transactionAmount: transactionAmount * 100000000,
              feeLevel: feeLevel
            })
          },
          getMaximumTransactionAmount: function (node, feeLevel) {
            return sendMessage({
              messageType: 'GetMaximumTransactionAmount',
              walletNode: node,
              feeLevel: feeLevel
            });
          }
        };
      }
    ];
  })
  .config(['DeviceBridgeServiceProvider',
    function (deviceBridgeServiceProvider) {

      function navigateToLocation(locationTemplate) {
        return ['NavigationService', '$rootScope',
          function (navigationService, $rootScope) {
            var location = locationTemplate;
            for (var field in this.request.message) {
              if (this.request.message.hasOwnProperty(field)) {
                location = location.replace(':' + field, encodeURIComponent(_.snakeCase(this.request.message[field])));
              }
            }
            navigationService.go(location);
            $rootScope.$digest();
          }
        ];
      }

      deviceBridgeServiceProvider.when('connected', ['DeviceBridgeService',
        function (deviceBridgeService) {
          deviceBridgeService.initialize();
        }
      ]);

      deviceBridgeServiceProvider.when('disconnected', navigateToLocation('/connect'));
      deviceBridgeServiceProvider.when('PinMatrixRequest', navigateToLocation('/pin/:type'));
      deviceBridgeServiceProvider.when('ButtonRequest', ['$injector',
        function ($injector) {
          if (this.request.message.code !== 'ButtonRequest_Address') {
            $injector.invoke(navigateToLocation('/buttonRequest/:code'), this);
          }
        }]);
      deviceBridgeServiceProvider.when('WordRequest', navigateToLocation('/wordRequest'));
      deviceBridgeServiceProvider.when('CharacterRequest', navigateToLocation('/characterRequest/:word_pos/:character_pos'));
      deviceBridgeServiceProvider.when('Success', navigateToLocation('/success/:message'));
      deviceBridgeServiceProvider.when('Failure', ['$injector', 'FailureMessageService', 'NavigationService',
        function ($injector, failureMessageService, navigationService) {
          if (this.request.message.message === "Show address cancelled") {
            return;
          }
          failureMessageService.add(this.request.message);
          navigationService.setNextDestination();
          $injector.invoke(navigateToLocation('/failure/:message'), this);
        }
      ]);
      deviceBridgeServiceProvider.when('TxRequest', ['NavigationService', 'TransactionService', '$rootScope',
        function (navigationService, transactionService, $rootScope) {
          if (this.request.message.request_type === 'TXFINISHED') {
            angular.copy({}, transactionService.transactionInProgress);
            navigationService.go('/initialized');
            $rootScope.$digest();
          }
        }
      ]);
      deviceBridgeServiceProvider.when('Features', ['NavigationService', 'DeviceFeatureService', '$rootScope',
        function (navigationService, deviceFeatureService, $rootScope) {
          deviceFeatureService.set(this.request.message);
          if (deviceFeatureService.features.bootloader_mode) {
            navigationService.go('/bootloader');
          }
          else if (deviceFeatureService.features.initialized) {
            navigationService.go('/initialized');
          }
          else {
            navigationService.go('/initialize');
          }
          $rootScope.$digest();
        }
      ]);

      deviceBridgeServiceProvider.when('ImageHashCode', ['ProxyInfoService',
        function (proxyInfoService) {
          proxyInfoService.set(this.request.message);
        }
      ]);

      deviceBridgeServiceProvider.when('ping', function () {
        // Do nothing
      });

      deviceBridgeServiceProvider.when('WalletNodes', ['WalletNodeService',
        function (walletNodeService) {
          walletNodeService.updateWalletNodes(this.request.message);
        }
      ]);

      deviceBridgeServiceProvider.when('Transactions', ['TransactionService',
        function (transactionService) {
          transactionService.updateTransactions(this.request.message);
        }
      ]);

      deviceBridgeServiceProvider.when('Fees', ['FeeService',
        function (feeService) {
          feeService.set(this.request.message);
        }
      ]);

      deviceBridgeServiceProvider.when('EstimatedTransactionFee', ['FeeService',
        function (feeService) {
          feeService.setEstimate(this.request.message);
        }
      ]);

      deviceBridgeServiceProvider.when('MaximumTransactionAmount', ['FeeService',
        function (feeService) {
          feeService.setMaxTransactionAmount(this.request.message);
        }
      ]);

      deviceBridgeServiceProvider.when('unknownSender', function () {
        this.sendResponse({
          messageType: "Error",
          result: "Unknown sender " + this.sender.id + ", message rejected"
        });
      });

      deviceBridgeServiceProvider.when('unknownMessageType', function () {
        this.sendResponse({
          messageType: "Error",
          result: "Unknown messageType " + this.request.messageType + ", message rejected"
        });
      });
    }
  ])
  .run(['DeviceBridgeService',
    function (deviceBridgeService) {
      deviceBridgeService.startListener();
    }
  ]);
