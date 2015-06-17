angular.module('kkWallet')
    .controller('InitializationController', ['$scope', 'InitializationDataService',
        function InitializationController($scope, initializationDataService) {
            $scope.initializationData = initializationDataService;
            $scope.displayPin = '';

            $scope.appendToPin = function(digit) {
                $scope.initializationData.pin = '' + $scope.initializationData.pin + digit;
            };

            $scope.$watch('initializationData.pin', function() {
                $scope.displayPin = new Array($scope.initializationData.pin.length + 1).join('*');
            });

        }
    ])
    .factory('InitializationDataService', function () {
        return {
            label: '',
            pin: ''
        };
    });