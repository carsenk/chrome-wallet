angular.module('kkWallet')
  .controller('SendController', ['$scope', '$routeParams', '$interpolate', 'DeviceBridgeService', 'NavigationService', 'WalletNodeService', 'TransactionService', 'FeeService',
    function SendController($scope, $routeParams, $interpolate, deviceBridgeService, navigationService, walletNodeService, transactionService, feeService) {
      walletNodeService.reload();

      feeService.update();

      $scope.feeOptions = feeService.feeOptions;
      $scope.estimatedFee = feeService.estimatedFee;
      $scope.maxAmount = feeService.maxTransactionAmount;

      $scope.wallet = walletNodeService.getWalletById($routeParams.wallet);
      $scope.showForm = !!($scope.wallet.highConfidenceBalance);
      $scope.preparingTransaction = false;

      $scope.userInput = {
        sourceIndex: $routeParams.wallet,
        sourceName: $scope.wallet.name,
        address: '',
        amount: '',
        feeLevel: $scope.feeOptions[0]
      };
      $scope.buildTransaction = function () {
        $scope.preparingTransaction = true;
        transactionService.transactionInProgress = {
          accountId: $scope.wallet.id,
          amount: $scope.userInput.amount,
          feeLevel: $scope.userInput.feeLevel
        };

        var destinationAccount = _.get($scope.userInput, 'address.id');
        if (destinationAccount) {
          transactionService.transactionInProgress.sendToAccount = destinationAccount;
        } else {
          transactionService.transactionInProgress.sendTo = $scope.userInput.address;
        }

        deviceBridgeService.requestTransactionSignature(transactionService.transactionInProgress);
        navigationService.setNextTransition('slideLeft');
      };

      $scope.setFeeLevel = function (option) {
        $scope.userInput.feeLevel = option;
      };

      $scope.getFee = function (feeLevelOption) {
        return _.get($scope, 'estimatedFee.fee.' + feeLevelOption) || 0;
      };

      if ($scope.wallet.id) {
        feeService.getMaximumTransactionAmount($scope.wallet.id);
      }

      $scope.$watch('userInput.amount', function computeFees() {
        if ($scope.wallet.id) {
          feeService.compute($scope.wallet.id, $scope.userInput.amount);
        }
      });
      $scope.$watch('wallet.id', function() {
        if ($scope.wallet.id) {
          feeService.getMaximumTransactionAmount($scope.wallet.id);
          feeService.compute($scope.wallet.id, $scope.userInput.amount);
        }
      });
    }
  ]);
